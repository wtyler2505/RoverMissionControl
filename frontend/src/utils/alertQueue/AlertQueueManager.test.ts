/**
 * @jest-environment jsdom
 */

import { AlertQueueManager, AlertQueueConfig, ProcessedAlert, AlertProcessor } from './AlertQueueManager';
import { AlertPriority } from '../../theme/alertPriorities';

// Mock timers for testing delayed processing
jest.useFakeTimers();

describe('AlertQueueManager', () => {
  let manager: AlertQueueManager;
  let mockProcessor: jest.MockedFunction<AlertProcessor>;

  beforeEach(() => {
    jest.clearAllTimers();
    manager = new AlertQueueManager();
    mockProcessor = jest.fn();
    manager.addProcessor(mockProcessor);
  });

  afterEach(() => {
    manager.clear();
  });

  describe('Basic Operations', () => {
    test('should initialize with default configuration', () => {
      const status = manager.getStatus();
      expect(status.total).toBe(0);
      expect(status.processed).toBe(0);
      expect(status.grouped).toBe(0);
    });

    test('should add alert and return ID', async () => {
      const id = await manager.addAlert({
        priority: 'high',
        data: { message: 'Test alert' }
      });

      expect(id).toMatch(/^alert-\d+-[a-z0-9]+$/);
      expect(manager.getStatus().total).toBe(1);
    });

    test('should remove alert by ID', async () => {
      const id = await manager.addAlert({
        priority: 'medium',
        data: { message: 'Test alert' }
      });

      expect(manager.removeAlert(id)).toBe(true);
      expect(manager.getStatus().total).toBe(0);
      expect(manager.removeAlert('nonexistent')).toBe(false);
    });

    test('should clear all alerts', async () => {
      await manager.addAlert({ priority: 'high', data: { message: 'Alert 1' } });
      await manager.addAlert({ priority: 'low', data: { message: 'Alert 2' } });
      
      expect(manager.getStatus().total).toBe(2);
      
      manager.clear();
      expect(manager.getStatus().total).toBe(0);
    });
  });

  describe('Priority-based Processing', () => {
    test('should process critical alerts immediately', async () => {
      await manager.addAlert({
        priority: 'critical',
        data: { message: 'Critical alert' }
      });

      // Critical alerts should be processed immediately (0ms delay)
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      
      const processedAlert = mockProcessor.mock.calls[0][0];
      expect(processedAlert.priority).toBe('critical');
      expect(processedAlert.data.message).toBe('Critical alert');
    });

    test('should process high priority alerts after 5 seconds', async () => {
      await manager.addAlert({
        priority: 'high',
        data: { message: 'High priority alert' }
      });

      // Should not be processed immediately
      expect(mockProcessor).not.toHaveBeenCalled();

      // Fast-forward 5 seconds
      jest.advanceTimersByTime(5000);

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      const processedAlert = mockProcessor.mock.calls[0][0];
      expect(processedAlert.priority).toBe('high');
    });

    test('should process medium priority alerts after 30 seconds', async () => {
      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Medium priority alert' }
      });

      expect(mockProcessor).not.toHaveBeenCalled();

      // Fast-forward 29 seconds - should not process yet
      jest.advanceTimersByTime(29000);
      expect(mockProcessor).not.toHaveBeenCalled();

      // Fast-forward 1 more second (total 30s)
      jest.advanceTimersByTime(1000);
      expect(mockProcessor).toHaveBeenCalledTimes(1);
    });

    test('should process low and info priority alerts after 5 minutes', async () => {
      await manager.addAlert({
        priority: 'low',
        data: { message: 'Low priority alert' }
      });

      await manager.addAlert({
        priority: 'info',
        data: { message: 'Info alert' }
      });

      expect(mockProcessor).not.toHaveBeenCalled();

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(300000);

      expect(mockProcessor).toHaveBeenCalledTimes(2);
    });

    test('should process alerts in priority order regardless of add order', async () => {
      // Add in reverse priority order
      const infoId = await manager.addAlert({
        priority: 'info',
        data: { message: 'Info alert' }
      });

      const criticalId = await manager.addAlert({
        priority: 'critical',
        data: { message: 'Critical alert' }
      });

      const mediumId = await manager.addAlert({
        priority: 'medium',
        data: { message: 'Medium alert' }
      });

      // Critical should be processed immediately
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor.mock.calls[0][0].priority).toBe('critical');

      // Process all remaining alerts
      jest.advanceTimersByTime(300000);

      // Should have processed all 3 alerts
      expect(mockProcessor).toHaveBeenCalledTimes(3);
      
      // Check processing order based on priority
      const calls = mockProcessor.mock.calls;
      expect(calls[0][0].priority).toBe('critical');
      expect(calls[1][0].priority).toBe('medium');
      expect(calls[2][0].priority).toBe('info');
    });
  });

  describe('Custom Configuration', () => {
    test('should use custom processing delays', () => {
      const customConfig: Partial<AlertQueueConfig> = {
        processingDelays: {
          critical: 1000,
          high: 2000,
          medium: 3000,
          low: 4000,
          info: 5000,
        }
      };

      const customManager = new AlertQueueManager(customConfig);
      const customProcessor = jest.fn();
      customManager.addProcessor(customProcessor);

      customManager.addAlert({
        priority: 'critical',
        data: { message: 'Custom critical' }
      });

      // Should not process immediately with custom 1s delay
      expect(customProcessor).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(customProcessor).toHaveBeenCalledTimes(1);
    });

    test('should respect custom alert limits', () => {
      const customConfig: Partial<AlertQueueConfig> = {
        maxAlertsPerPriority: {
          critical: 2,
          high: 2,
          medium: 2,
          low: 2,
          info: 2,
        },
        maxTotalAlerts: 5,
        overflowStrategy: 'drop-oldest'
      };

      const customManager = new AlertQueueManager(customConfig);
      
      // Add alerts up to the limit
      for (let i = 0; i < 6; i++) {
        customManager.addAlert({
          priority: 'medium',
          data: { message: `Alert ${i}` }
        });
      }

      const status = customManager.getStatus();
      expect(status.total).toBeLessThanOrEqual(5);
    });
  });

  describe('Overflow Strategies', () => {
    let overflowManager: AlertQueueManager;

    beforeEach(() => {
      const config: Partial<AlertQueueConfig> = {
        maxAlertsPerPriority: {
          critical: 2,
          high: 2,
          medium: 2,
          low: 2,
          info: 2,
        },
        maxTotalAlerts: 5,
        overflowStrategy: 'drop-oldest'
      };
      overflowManager = new AlertQueueManager(config);
    });

    test('should drop oldest alerts when using drop-oldest strategy', async () => {
      // Fill up the queue
      for (let i = 0; i < 5; i++) {
        await overflowManager.addAlert({
          priority: 'medium',
          data: { message: `Alert ${i}`, index: i }
        });
      }

      expect(overflowManager.getStatus().total).toBe(5);

      // Add one more - should trigger overflow
      await overflowManager.addAlert({
        priority: 'medium',
        data: { message: 'New alert', index: 5 }
      });

      const status = overflowManager.getStatus();
      expect(status.total).toBeLessThanOrEqual(5);
      
      // The oldest alert should be removed
      const alerts = overflowManager.getAllAlerts();
      const hasOldest = alerts.some(alert => alert.data.index === 0);
      expect(hasOldest).toBe(false);
    });

    test('should drop lowest priority alerts when using drop-lowest strategy', async () => {
      const config: Partial<AlertQueueConfig> = {
        maxTotalAlerts: 3,
        overflowStrategy: 'drop-lowest'
      };
      const dropLowestManager = new AlertQueueManager(config);

      await dropLowestManager.addAlert({
        priority: 'critical',
        data: { message: 'Critical alert' }
      });

      await dropLowestManager.addAlert({
        priority: 'info',
        data: { message: 'Info alert' }
      });

      await dropLowestManager.addAlert({
        priority: 'high',
        data: { message: 'High alert' }
      });

      expect(dropLowestManager.getStatus().total).toBe(3);

      // Add another critical - should drop info alert
      await dropLowestManager.addAlert({
        priority: 'critical',
        data: { message: 'Another critical' }
      });

      const alerts = dropLowestManager.getAllAlerts();
      const hasInfo = alerts.some(alert => alert.priority === 'info');
      expect(hasInfo).toBe(false);
    });

    test('should compress similar alerts when using compress strategy', async () => {
      const config: Partial<AlertQueueConfig> = {
        maxTotalAlerts: 5,
        overflowStrategy: 'compress'
      };
      const compressManager = new AlertQueueManager(config);

      // Add similar alerts that should be compressed
      for (let i = 0; i < 6; i++) {
        await compressManager.addAlert({
          priority: 'medium',
          data: { 
            type: 'network-error',
            message: `Network error ${i}` 
          }
        });
      }

      // Should have compressed similar alerts
      const alerts = compressManager.getAllAlerts();
      expect(alerts.length).toBeLessThan(6);
      
      // Should have group information
      const groupedAlert = alerts.find(alert => alert.data.groupCount);
      expect(groupedAlert).toBeDefined();
    });
  });

  describe('Alert Grouping', () => {
    test('should group alerts with same groupId', async () => {
      const groupId = 'network-errors';

      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Error 1' },
        groupId
      });

      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Error 2' },
        groupId
      });

      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Error 3' },
        groupId
      });

      const status = manager.getStatus();
      expect(status.grouped).toBe(1); // One group
      expect(status.total).toBe(1); // Only the first alert is in the main queue

      const alerts = manager.getAllAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].groupCount).toBe(3);
    });

    test('should handle mixed grouped and ungrouped alerts', async () => {
      await manager.addAlert({
        priority: 'high',
        data: { message: 'Standalone alert' }
      });

      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Group alert 1' },
        groupId: 'group-1'
      });

      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Group alert 2' },
        groupId: 'group-1'
      });

      const status = manager.getStatus();
      expect(status.total).toBe(2); // Standalone + one from group
      expect(status.grouped).toBe(1);
      
      const alerts = manager.getAllAlerts();
      const groupedAlert = alerts.find(a => a.groupId);
      expect(groupedAlert?.groupCount).toBe(2);
    });

    test('should remove entire group when grouped alert is removed', async () => {
      const groupId = 'test-group';
      
      const alert1Id = await manager.addAlert({
        priority: 'medium',
        data: { message: 'Group alert 1' },
        groupId
      });

      await manager.addAlert({
        priority: 'medium',
        data: { message: 'Group alert 2' },
        groupId
      });

      expect(manager.getStatus().grouped).toBe(1);

      manager.removeAlert(alert1Id);
      
      expect(manager.getStatus().grouped).toBe(0);
      expect(manager.getStatus().total).toBe(0);
    });
  });

  describe('Alert Expiration', () => {
    test('should automatically remove expired alerts', async () => {
      const customConfig: Partial<AlertQueueConfig> = {
        defaultExpiration: {
          critical: null, // Never expires
          high: 1000, // 1 second
          medium: 2000, // 2 seconds
          low: 500, // 0.5 seconds
          info: 100, // 0.1 seconds
        }
      };

      const expirationManager = new AlertQueueManager(customConfig);

      await expirationManager.addAlert({
        priority: 'high',
        data: { message: 'High alert' }
      });

      await expirationManager.addAlert({
        priority: 'critical',
        data: { message: 'Critical alert' }
      });

      await expirationManager.addAlert({
        priority: 'info',
        data: { message: 'Info alert' }
      });

      expect(expirationManager.getStatus().total).toBe(3);

      // Fast-forward to expire some alerts
      jest.advanceTimersByTime(1500);

      // Should trigger expiration check
      jest.runOnlyPendingTimers();

      const status = expirationManager.getStatus();
      expect(status.total).toBeLessThan(3);
      
      // Critical should still exist (no expiration)
      const alerts = expirationManager.getAllAlerts();
      const hasCritical = alerts.some(a => a.priority === 'critical');
      expect(hasCritical).toBe(true);
    });
  });

  describe('Processor Management', () => {
    test('should handle multiple processors', async () => {
      const processor2 = jest.fn();
      const processor3 = jest.fn();

      manager.addProcessor(processor2);
      manager.addProcessor(processor3);

      await manager.addAlert({
        priority: 'critical',
        data: { message: 'Test alert' }
      });

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(processor2).toHaveBeenCalledTimes(1);
      expect(processor3).toHaveBeenCalledTimes(1);

      // All should receive the same alert
      const alert1 = mockProcessor.mock.calls[0][0];
      const alert2 = processor2.mock.calls[0][0];
      const alert3 = processor3.mock.calls[0][0];

      expect(alert1.id).toBe(alert2.id);
      expect(alert2.id).toBe(alert3.id);
    });

    test('should remove processors', async () => {
      const processor2 = jest.fn();
      manager.addProcessor(processor2);

      await manager.addAlert({
        priority: 'critical',
        data: { message: 'Test 1' }
      });

      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(processor2).toHaveBeenCalledTimes(1);

      manager.removeProcessor(processor2);

      await manager.addAlert({
        priority: 'critical',
        data: { message: 'Test 2' }
      });

      expect(mockProcessor).toHaveBeenCalledTimes(2);
      expect(processor2).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should handle processor errors gracefully', async () => {
      const errorProcessor = jest.fn().mockRejectedValue(new Error('Processor error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      manager.addProcessor(errorProcessor);

      await manager.addAlert({
        priority: 'critical',
        data: { message: 'Test alert' }
      });

      expect(errorProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledTimes(1); // Other processors should still work
      expect(consoleSpy).toHaveBeenCalledWith('Alert processor error:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Status and Querying', () => {
    beforeEach(async () => {
      await manager.addAlert({ priority: 'critical', data: { message: 'Critical 1' } });
      await manager.addAlert({ priority: 'critical', data: { message: 'Critical 2' } });
      await manager.addAlert({ priority: 'high', data: { message: 'High 1' } });
      await manager.addAlert({ priority: 'medium', data: { message: 'Medium 1' } });
      await manager.addAlert({ 
        priority: 'low', 
        data: { message: 'Low 1' },
        groupId: 'low-group'
      });
      await manager.addAlert({ 
        priority: 'low', 
        data: { message: 'Low 2' },
        groupId: 'low-group'
      });
    });

    test('should provide accurate status', () => {
      const status = manager.getStatus();
      
      expect(status.total).toBe(5); // 4 individual + 1 group representative
      expect(status.byPriority.critical).toBe(2);
      expect(status.byPriority.high).toBe(1);
      expect(status.byPriority.medium).toBe(1);
      expect(status.byPriority.low).toBe(1);
      expect(status.byPriority.info).toBe(0);
      expect(status.grouped).toBe(1);
    });

    test('should return all alerts in priority order', () => {
      const alerts = manager.getAllAlerts();
      
      expect(alerts).toHaveLength(5);
      expect(alerts[0].priority).toBe('critical');
      expect(alerts[1].priority).toBe('critical');
      expect(alerts[2].priority).toBe('high');
      expect(alerts[3].priority).toBe('medium');
      expect(alerts[4].priority).toBe('low');
      
      // Check grouped alert
      const groupedAlert = alerts.find(a => a.groupId === 'low-group');
      expect(groupedAlert?.groupCount).toBe(2);
    });

    test('should include processing metadata', () => {
      jest.advanceTimersByTime(10000); // Process some alerts

      const alerts = manager.getAllAlerts();
      
      alerts.forEach((alert, index) => {
        expect(alert.processedAt).toBeInstanceOf(Date);
        expect(alert.position).toBe(index);
        expect(typeof alert.isGrouped).toBe('boolean');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle rapid sequential additions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        manager.addAlert({
          priority: 'medium',
          data: { message: `Rapid alert ${i}` }
        })
      );

      const ids = await Promise.all(promises);
      
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10); // All IDs should be unique
      expect(manager.getStatus().total).toBe(10);
    });

    test('should handle empty alert data', async () => {
      const id = await manager.addAlert({
        priority: 'info',
        data: null as any
      });

      expect(id).toBeTruthy();
      expect(manager.getStatus().total).toBe(1);
    });

    test('should handle invalid priority gracefully', async () => {
      const id = await manager.addAlert({
        priority: 'invalid' as any,
        data: { message: 'Invalid priority' }
      });

      expect(id).toBeTruthy();
      // Implementation should either reject or use a default priority
    });

    test('should maintain state after clearing', async () => {
      await manager.addAlert({ priority: 'high', data: { message: 'Test' } });
      
      manager.clear();
      
      const status = manager.getStatus();
      expect(status.total).toBe(0);
      expect(status.processed).toBe(0);
      expect(status.grouped).toBe(0);
      
      // Should be able to add new alerts after clearing
      await manager.addAlert({ priority: 'medium', data: { message: 'After clear' } });
      expect(manager.getStatus().total).toBe(1);
    });
  });

  describe('Performance', () => {
    test('should handle high volume of alerts efficiently', async () => {
      const startTime = performance.now();
      const alertCount = 500;

      const promises = Array.from({ length: alertCount }, (_, i) =>
        manager.addAlert({
          priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
          data: { message: `Performance test alert ${i}` }
        })
      );

      await Promise.all(promises);
      
      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(1000); // Should take less than 1 second
      expect(manager.getStatus().total).toBe(alertCount);
    });

    test('should process alerts efficiently under load', async () => {
      const processingTimes: number[] = [];
      const timeTrackingProcessor: AlertProcessor = async (alert) => {
        const start = performance.now();
        // Simulate some processing work
        await new Promise(resolve => setTimeout(resolve, 1));
        processingTimes.push(performance.now() - start);
      };

      manager.addProcessor(timeTrackingProcessor);

      // Add many critical alerts (processed immediately)
      for (let i = 0; i < 50; i++) {
        await manager.addAlert({
          priority: 'critical',
          data: { message: `Load test ${i}` }
        });
      }

      // Average processing time should be reasonable
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      expect(avgTime).toBeLessThan(10); // Less than 10ms average
    });
  });
});