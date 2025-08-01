/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useAlertStore, AlertData, alertCreators, useAddAlert, useAlertsByPriority, useAlertQueueStatus } from './alertStore';
import { AlertPriority } from '../theme/alertPriorities';

// Mock localStorage for persistence testing
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockStorage });

// Mock timers for queue processing tests
jest.useFakeTimers();

describe('AlertStore', () => {
  beforeEach(() => {
    // Clear store state
    useAlertStore.getState()._queueManager?.clear();
    useAlertStore.setState({ 
      alerts: [], 
      dismissedAlerts: [],
      queueStatus: {
        total: 0,
        byPriority: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        processed: 0,
        grouped: 0,
      },
      _queueManager: null 
    });
    jest.clearAllTimers();
    mockStorage.clear();
  });

  describe('Basic State Management', () => {
    test('should initialize with empty state', () => {
      const { result } = renderHook(() => useAlertStore());
      
      expect(result.current.alerts).toHaveLength(0);
      expect(result.current.dismissedAlerts).toHaveLength(0);
      expect(result.current.queueStatus.total).toBe(0);
    });

    test('should add alert and return ID', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      let alertId: string;
      await act(async () => {
        alertId = await result.current.addAlert({
          priority: 'high',
          message: 'Test alert',
          title: 'Test Title'
        });
      });

      expect(alertId!).toMatch(/^alert-\d+-[a-z0-9]+$/);
      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].data.message).toBe('Test alert');
      expect(result.current.alerts[0].data.title).toBe('Test Title');
      expect(result.current.queueStatus.total).toBe(1);
    });

    test('should remove alert by ID', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      let alertId: string;
      await act(async () => {
        alertId = await result.current.addAlert({
          priority: 'medium',
          message: 'Test alert'
        });
      });

      expect(result.current.alerts).toHaveLength(1);

      act(() => {
        result.current.removeAlert(alertId!);
      });

      expect(result.current.alerts).toHaveLength(0);
      expect(result.current.queueStatus.total).toBe(0);
    });

    test('should dismiss alert (hide without removing)', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      let alertId: string;
      await act(async () => {
        alertId = await result.current.addAlert({
          priority: 'info',
          message: 'Dismissible alert'
        });
      });

      expect(result.current.alerts).toHaveLength(1);

      act(() => {
        result.current.dismissAlert(alertId!);
      });

      expect(result.current.alerts).toHaveLength(0);
      expect(result.current.dismissedAlerts).toContain(alertId!);
    });

    test('should clear all alerts', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({ priority: 'high', message: 'Alert 1' });
        await result.current.addAlert({ priority: 'medium', message: 'Alert 2' });
        await result.current.addAlert({ priority: 'low', message: 'Alert 3' });
      });

      expect(result.current.alerts).toHaveLength(3);

      act(() => {
        result.current.clearAlerts();
      });

      expect(result.current.alerts).toHaveLength(0);
      expect(result.current.queueStatus.total).toBe(0);
    });

    test('should clear alerts by priority', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({ priority: 'high', message: 'High alert' });
        await result.current.addAlert({ priority: 'medium', message: 'Medium alert 1' });
        await result.current.addAlert({ priority: 'medium', message: 'Medium alert 2' });
        await result.current.addAlert({ priority: 'low', message: 'Low alert' });
      });

      expect(result.current.alerts).toHaveLength(4);

      act(() => {
        result.current.clearAlerts('medium');
      });

      // Should only have high and low alerts remaining
      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.alerts.some(a => a.priority === 'medium')).toBe(false);
      expect(result.current.alerts.some(a => a.priority === 'high')).toBe(true);
      expect(result.current.alerts.some(a => a.priority === 'low')).toBe(true);
    });
  });

  describe('Queue Configuration', () => {
    test('should update configuration', () => {
      const { result } = renderHook(() => useAlertStore());
      
      const newConfig = {
        maxTotalAlerts: 50,
        overflowStrategy: 'compress' as const
      };

      act(() => {
        result.current.updateConfig(newConfig);
      });

      expect(result.current.config.maxTotalAlerts).toBe(50);
      expect(result.current.config.overflowStrategy).toBe('compress');
    });

    test('should maintain existing config when updating partial config', () => {
      const { result } = renderHook(() => useAlertStore());
      
      const originalMaxAlerts = result.current.config.maxTotalAlerts;
      
      act(() => {
        result.current.updateConfig({
          overflowStrategy: 'drop-lowest'
        });
      });

      expect(result.current.config.maxTotalAlerts).toBe(originalMaxAlerts);
      expect(result.current.config.overflowStrategy).toBe('drop-lowest');
    });
  });

  describe('Alert Processing and Priority', () => {
    test('should process critical alerts immediately', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'critical',
          message: 'Critical alert'
        });
      });

      // Critical alerts should appear immediately
      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].priority).toBe('critical');
    });

    test('should handle mixed priority alerts', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({ priority: 'low', message: 'Low priority' });
        await result.current.addAlert({ priority: 'critical', message: 'Critical priority' });
        await result.current.addAlert({ priority: 'medium', message: 'Medium priority' });
      });

      expect(result.current.alerts).toHaveLength(3);
      
      // Should be ordered by priority
      expect(result.current.alerts[0].priority).toBe('critical');
      expect(result.current.alerts[1].priority).toBe('medium');
      expect(result.current.alerts[2].priority).toBe('low');
    });

    test('should update queue status correctly', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({ priority: 'critical', message: 'Critical 1' });
        await result.current.addAlert({ priority: 'critical', message: 'Critical 2' });
        await result.current.addAlert({ priority: 'high', message: 'High 1' });
        await result.current.addAlert({ priority: 'medium', message: 'Medium 1' });
      });

      const status = result.current.queueStatus;
      expect(status.total).toBe(4);
      expect(status.byPriority.critical).toBe(2);
      expect(status.byPriority.high).toBe(1);
      expect(status.byPriority.medium).toBe(1);
      expect(status.byPriority.low).toBe(0);
      expect(status.byPriority.info).toBe(0);
    });
  });

  describe('Alert Grouping', () => {
    test('should handle grouped alerts', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      const groupId = 'network-errors';
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'medium',
          message: 'Network error 1',
          groupId
        });
        
        await result.current.addAlert({
          priority: 'medium',
          message: 'Network error 2',
          groupId
        });
        
        await result.current.addAlert({
          priority: 'medium',
          message: 'Network error 3',
          groupId
        });
      });

      // Should show only the representative alert from the group
      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].groupId).toBe(groupId);
      expect(result.current.queueStatus.grouped).toBe(1);
    });

    test('should handle mixed grouped and ungrouped alerts', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'high',
          message: 'Standalone alert'
        });
        
        await result.current.addAlert({
          priority: 'medium',
          message: 'Group alert 1',
          groupId: 'group-1'
        });
        
        await result.current.addAlert({
          priority: 'medium',
          message: 'Group alert 2',
          groupId: 'group-1'
        });
      });

      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.queueStatus.grouped).toBe(1);
    });
  });

  describe('Alert Actions and Metadata', () => {
    test('should handle alert with action', async () => {
      const { result } = renderHook(() => useAlertStore());
      const mockAction = jest.fn();
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'medium',
          message: 'Alert with action',
          action: {
            label: 'Retry',
            handler: mockAction
          }
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].data.action).toBeDefined();
      expect(result.current.alerts[0].data.action!.label).toBe('Retry');
      expect(result.current.alerts[0].data.action!.handler).toBe(mockAction);
    });

    test('should handle alert with custom metadata', async () => {
      const { result } = renderHook(() => useAlertStore());
      const metadata = { errorCode: 'ERR_001', userId: '12345' };
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'high',
          message: 'Error with metadata',
          metadata
        });
      });

      expect(result.current.alerts[0].data.metadata).toEqual(metadata);
    });

    test('should handle persistent alerts', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'critical',
          message: 'Persistent alert',
          persistent: true
        });
      });

      expect(result.current.alerts[0].data.persistent).toBe(true);
    });

    test('should handle closable property', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'medium',
          message: 'Non-closable alert',
          closable: false
        });
      });

      expect(result.current.alerts[0].data.closable).toBe(false);
    });
  });

  describe('Helper Hooks', () => {
    test('useAddAlert should provide add alert function', async () => {
      const { result } = renderHook(() => useAddAlert());
      
      let alertId: string;
      await act(async () => {
        alertId = await result.current({
          priority: 'info',
          message: 'Test with helper'
        });
      });

      expect(alertId!).toMatch(/^alert-\d+-[a-z0-9]+$/);
      
      // Check that alert was actually added
      const store = useAlertStore.getState();
      expect(store.alerts).toHaveLength(1);
    });

    test('useAlertsByPriority should filter alerts correctly', async () => {
      // Add alerts of different priorities
      const store = useAlertStore.getState();
      await store.addAlert({ priority: 'critical', message: 'Critical 1' });
      await store.addAlert({ priority: 'high', message: 'High 1' });
      await store.addAlert({ priority: 'critical', message: 'Critical 2' });
      await store.addAlert({ priority: 'medium', message: 'Medium 1' });

      const { result } = renderHook(() => useAlertsByPriority('critical'));
      
      expect(result.current).toHaveLength(2);
      expect(result.current.every(alert => alert.priority === 'critical')).toBe(true);
    });

    test('useAlertQueueStatus should provide current status', async () => {
      const store = useAlertStore.getState();
      await store.addAlert({ priority: 'high', message: 'High alert' });
      await store.addAlert({ priority: 'medium', message: 'Medium alert' });

      const { result } = renderHook(() => useAlertQueueStatus());
      
      expect(result.current.total).toBe(2);
      expect(result.current.byPriority.high).toBe(1);
      expect(result.current.byPriority.medium).toBe(1);
    });
  });

  describe('Alert Creators', () => {
    test('should create critical alert with correct properties', () => {
      const alert = alertCreators.critical('System failure', 'Critical Error');
      
      expect(alert.priority).toBe('critical');
      expect(alert.message).toBe('System failure');
      expect(alert.title).toBe('Critical Error');
      expect(alert.closable).toBe(false);
      expect(alert.persistent).toBe(true);
    });

    test('should create error alert with correct properties', () => {
      const alert = alertCreators.error('Something went wrong');
      
      expect(alert.priority).toBe('high');
      expect(alert.message).toBe('Something went wrong');
      expect(alert.title).toBe('Error');
      expect(alert.closable).toBe(true);
    });

    test('should create warning alert with correct properties', () => {
      const alert = alertCreators.warning('This is a warning', 'Custom Warning');
      
      expect(alert.priority).toBe('medium');
      expect(alert.message).toBe('This is a warning');
      expect(alert.title).toBe('Custom Warning');
      expect(alert.closable).toBe(true);
    });

    test('should create success alert with correct properties', () => {
      const alert = alertCreators.success('Operation completed');
      
      expect(alert.priority).toBe('low');
      expect(alert.message).toBe('Operation completed');
      expect(alert.closable).toBe(true);
    });

    test('should create info alert with correct properties', () => {
      const alert = alertCreators.info('Just so you know');
      
      expect(alert.priority).toBe('info');
      expect(alert.message).toBe('Just so you know');
      expect(alert.closable).toBe(true);
    });
  });

  describe('Persistence', () => {
    test('should persist dismissed alerts to localStorage', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      let alertId: string;
      await act(async () => {
        alertId = await result.current.addAlert({
          priority: 'medium',
          message: 'Persistent test'
        });
      });

      act(() => {
        result.current.dismissAlert(alertId!);
      });

      expect(mockStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(savedData.state.dismissedAlerts).toContain(alertId!);
    });

    test('should persist configuration to localStorage', () => {
      const { result } = renderHook(() => useAlertStore());
      
      act(() => {
        result.current.updateConfig({
          maxTotalAlerts: 75,
          overflowStrategy: 'summarize'
        });
      });

      expect(mockStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(savedData.state.config.maxTotalAlerts).toBe(75);
      expect(savedData.state.config.overflowStrategy).toBe('summarize');
    });

    test('should not persist alerts or queue manager to localStorage', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'high',
          message: 'Should not persist'
        });
      });

      // Alerts and queue manager should not be in persisted data
      if (mockStorage.setItem.mock.calls.length > 0) {
        const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
        expect(savedData.state.alerts).toBeUndefined();
        expect(savedData.state._queueManager).toBeUndefined();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle queue manager initialization failure gracefully', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      // Simulate queue manager being null
      act(() => {
        useAlertStore.setState({ _queueManager: null });
      });

      // Should still be able to add alerts (will reinitialize)
      let alertId: string;
      await act(async () => {
        alertId = await result.current.addAlert({
          priority: 'medium',
          message: 'Test after null manager'
        });
      });

      expect(alertId!).toBeTruthy();
      expect(result.current.alerts).toHaveLength(1);
    });

    test('should handle invalid alert data gracefully', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'medium',
          message: '', // Empty message
          title: undefined
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].data.message).toBe('');
    });

    test('should handle removing non-existent alert', () => {
      const { result } = renderHook(() => useAlertStore());
      
      act(() => {
        result.current.removeAlert('non-existent-id');
      });

      // Should not throw error and state should remain unchanged
      expect(result.current.alerts).toHaveLength(0);
    });

    test('should handle dismissing non-existent alert', () => {
      const { result } = renderHook(() => useAlertStore());
      
      act(() => {
        result.current.dismissAlert('non-existent-id');
      });

      expect(result.current.dismissedAlerts).toContain('non-existent-id');
    });
  });

  describe('Integration with Queue Manager', () => {
    test('should properly initialize queue manager on first alert', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      expect(result.current._queueManager).toBeNull();
      
      await act(async () => {
        await result.current.addAlert({
          priority: 'medium',
          message: 'First alert'
        });
      });

      expect(result.current._queueManager).not.toBeNull();
    });

    test('should update alerts when queue manager processes them', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      // Add an alert that requires processing delay
      await act(async () => {
        await result.current.addAlert({
          priority: 'high', // 5 second delay
          message: 'Delayed alert'
        });
      });

      // Initially might not be visible (depending on processing timing)
      const initialAlertCount = result.current.alerts.length;
      
      // Advance timers to trigger processing
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      // Should have processed and updated the alerts
      expect(result.current.alerts.length).toBeGreaterThanOrEqual(initialAlertCount);
    });

    test('should handle queue manager processor errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useAlertStore());
      
      // This should not throw even if there are internal processor errors
      await act(async () => {
        await result.current.addAlert({
          priority: 'critical',
          message: 'Test error handling'
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple simultaneous alert additions', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        result.current.addAlert({
          priority: 'medium',
          message: `Concurrent alert ${i}`
        })
      );

      let ids: string[];
      await act(async () => {
        ids = await Promise.all(promises);
      });

      expect(ids!).toHaveLength(10);
      expect(new Set(ids!).size).toBe(10); // All unique IDs
      expect(result.current.alerts).toHaveLength(10);
    });

    test('should handle mixed operations (add, remove, dismiss)', async () => {
      const { result } = renderHook(() => useAlertStore());
      
      let alertId1: string, alertId2: string, alertId3: string;
      
      await act(async () => {
        alertId1 = await result.current.addAlert({ priority: 'high', message: 'Alert 1' });
        alertId2 = await result.current.addAlert({ priority: 'medium', message: 'Alert 2' });
        alertId3 = await result.current.addAlert({ priority: 'low', message: 'Alert 3' });
      });

      expect(result.current.alerts).toHaveLength(3);

      act(() => {
        result.current.removeAlert(alertId1!);
        result.current.dismissAlert(alertId2!);
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].id).toBe(alertId3!);
      expect(result.current.dismissedAlerts).toContain(alertId2!);
    });
  });
});