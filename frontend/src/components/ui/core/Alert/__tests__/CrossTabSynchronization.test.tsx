/**
 * Comprehensive Tests for Cross-Tab Synchronization Functionality
 * Tests BroadcastChannel, SharedWorker, localStorage events, and multi-tab coordination
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { themes } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { 
  EnhancedAlertGroupingManager, 
  DismissalAction 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import { EnhancedAlertContainer } from '../EnhancedAlertContainer';

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  
  static channels: Map<string, MockBroadcastChannel[]> = new Map();

  constructor(name: string) {
    this.name = name;
    
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  postMessage(data: any) {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    const event = new MessageEvent('message', { data });
    
    // Simulate asynchronous message delivery
    setTimeout(() => {
      channels.forEach(channel => {
        if (channel !== this && channel.onmessage) {
          channel.onmessage(event);
        }
      });
    }, 0);
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    const index = channels.indexOf(this);
    if (index > -1) {
      channels.splice(index, 1);
    }
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = listener as (event: MessageEvent) => void;
    }
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message' && this.onmessage === listener) {
      this.onmessage = null;
    }
  }
}

// Mock SharedWorker
class MockSharedWorker {
  port: MockMessagePort;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(scriptURL: string, options?: string | WorkerOptions) {
    this.port = new MockMessagePort();
  }
}

class MockMessagePort {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  
  static ports: MockMessagePort[] = [];

  constructor() {
    MockMessagePort.ports.push(this);
  }

  postMessage(data: any) {
    const event = new MessageEvent('message', { data });
    
    setTimeout(() => {
      MockMessagePort.ports.forEach(port => {
        if (port !== this && port.onmessage) {
          port.onmessage(event);
        }
      });
    }, 0);
  }

  start() {
    // No-op for mock
  }

  close() {
    const index = MockMessagePort.ports.indexOf(this);
    if (index > -1) {
      MockMessagePort.ports.splice(index, 1);
    }
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'message') {
      this.onmessage = listener as (event: MessageEvent) => void;
    }
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'message' && this.onmessage === listener) {
      this.onmessage = null;
    }
  }
}

// Setup global mocks
Object.defineProperty(window, 'BroadcastChannel', {
  value: MockBroadcastChannel,
  writable: true,
});

Object.defineProperty(window, 'SharedWorker', {
  value: MockSharedWorker,
  writable: true,
});

// Mock localStorage with event support
const mockLocalStorage = (() => {
  const store: Record<string, string> = {};
  const listeners: ((event: StorageEvent) => void)[] = [];

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      const oldValue = store[key];
      store[key] = value;
      
      // Simulate storage event
      setTimeout(() => {
        const event = new StorageEvent('storage', {
          key,
          oldValue,
          newValue: value,
          storageArea: mockLocalStorage as any,
        });
        listeners.forEach(listener => listener(event));
      }, 0);
    }),
    removeItem: jest.fn((key: string) => {
      const oldValue = store[key];
      delete store[key];
      
      setTimeout(() => {
        const event = new StorageEvent('storage', {
          key,
          oldValue,
          newValue: null,
          storageArea: mockLocalStorage as any,
        });
        listeners.forEach(listener => listener(event));
      }, 0);
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: 0,
    key: jest.fn(),
    addEventListener: jest.fn((type: string, listener: EventListener) => {
      if (type === 'storage') {
        listeners.push(listener as (event: StorageEvent) => void);
      }
    }),
    removeEventListener: jest.fn((type: string, listener: EventListener) => {
      const index = listeners.indexOf(listener as (event: StorageEvent) => void);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Setup fake timers
jest.useFakeTimers();

interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => (
  <ThemeProvider theme={themes.default}>
    <div data-testid="test-wrapper">
      {children}
    </div>
  </ThemeProvider>
);

// Helper to create mock alerts
const createMockAlert = (
  id: string,
  priority: AlertPriority,
  message: string
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: new Date(),
  processAfter: new Date(),
  metadata: { source: 'test' },
  data: {
    message,
    title: `Alert ${id}`,
    closable: true,
  },
});

describe('Cross-Tab Synchronization', () => {
  let groupingManager1: EnhancedAlertGroupingManager;
  let groupingManager2: EnhancedAlertGroupingManager;

  beforeEach(() => {
    // Create two managers to simulate different tabs
    groupingManager1 = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    groupingManager2 = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    jest.clearAllMocks();
    MockBroadcastChannel.channels.clear();
    MockMessagePort.ports.length = 0;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('BroadcastChannel Synchronization', () => {
    it('should broadcast dismissal actions to other tabs', async () => {
      await act(async () => {
        await groupingManager1.dismissAlert('broadcast-1', 'manual', {
          reason: 'Broadcast test',
        });
      });

      // Allow broadcast to propagate
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Second tab should receive the dismissal
      const feedback = groupingManager2.getDismissalFeedback('broadcast-1');
      expect(feedback?.canDismiss).toBe(false);
    });

    it('should synchronize bulk dismissal operations', async () => {
      const alertIds = ['bulk-1', 'bulk-2', 'bulk-3'];

      await act(async () => {
        await groupingManager1.bulkDismiss(
          { alertIds },
          'bulk',
          { reason: 'Bulk test', user: 'tab1' }
        );
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // All alerts should be marked as dismissed in tab 2
      alertIds.forEach(id => {
        const feedback = groupingManager2.getDismissalFeedback(id);
        expect(feedback?.canDismiss).toBe(false);
      });
    });

    it('should broadcast undo operations across tabs', async () => {
      // First dismiss an alert in tab 1
      await act(async () => {
        await groupingManager1.dismissAlert('undo-sync-1', 'manual', {
          reason: 'Test for undo sync',
        });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Verify it's dismissed in tab 2
      let feedback = groupingManager2.getDismissalFeedback('undo-sync-1');
      expect(feedback?.canDismiss).toBe(false);

      // Undo the dismissal in tab 1
      const actionId = groupingManager1['undoManager'].actions[0]?.timestamp.getTime().toString();
      await act(async () => {
        await groupingManager1['undoManager'].undo(actionId);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should be undone in tab 2 as well
      feedback = groupingManager2.getDismissalFeedback('undo-sync-1');
      expect(feedback?.canDismiss).toBe(true);
    });

    it('should handle channel connection failures gracefully', async () => {
      // Mock BroadcastChannel to fail
      const originalBroadcastChannel = window.BroadcastChannel;
      Object.defineProperty(window, 'BroadcastChannel', {
        value: class {
          constructor() {
            throw new Error('BroadcastChannel not supported');
          }
        },
        writable: true,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const fallbackManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await fallbackManager.dismissAlert('fallback-test', 'manual');
      });

      // Should fall back to localStorage events
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BroadcastChannel not supported')
      );

      // Restore original
      Object.defineProperty(window, 'BroadcastChannel', {
        value: originalBroadcastChannel,
        writable: true,
      });

      consoleSpy.mockRestore();
    });

    it('should prevent infinite loops in broadcast messages', async () => {
      const broadcastSpy = jest.spyOn(MockBroadcastChannel.prototype, 'postMessage');

      await act(async () => {
        await groupingManager1.dismissAlert('loop-test', 'manual');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should not create broadcast loops
      expect(broadcastSpy).toHaveBeenCalledTimes(1);

      broadcastSpy.mockRestore();
    });
  });

  describe('SharedWorker Synchronization', () => {
    it('should coordinate state through SharedWorker when available', async () => {
      // Simulate SharedWorker coordination
      await act(async () => {
        await groupingManager1.dismissAlert('worker-sync-1', 'manual', {
          reason: 'SharedWorker test',
        });
      });

      // Message should propagate through SharedWorker
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const feedback = groupingManager2.getDismissalFeedback('worker-sync-1');
      expect(feedback?.canDismiss).toBe(false);
    });

    it('should handle SharedWorker initialization failures', () => {
      const originalSharedWorker = window.SharedWorker;
      Object.defineProperty(window, 'SharedWorker', {
        value: class {
          constructor() {
            throw new Error('SharedWorker not available');
          }
        },
        writable: true,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const fallbackManager = new EnhancedAlertGroupingManager();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SharedWorker not available')
      );

      // Restore original
      Object.defineProperty(window, 'SharedWorker', {
        value: originalSharedWorker,
        writable: true,
      });

      consoleSpy.mockRestore();
    });

    it('should maintain state consistency through worker coordination', async () => {
      const alerts = Array.from({ length: 10 }, (_, i) => 
        createMockAlert(`worker-${i}`, 'medium', `Worker test ${i}`)
      );

      // Dismiss alerts rapidly from both tabs
      const dismissalPromises = alerts.map(async (alert, index) => {
        const manager = index % 2 === 0 ? groupingManager1 : groupingManager2;
        await manager.dismissAlert(alert.id, 'manual', {
          reason: `Dismissed from tab ${index % 2 + 1}`,
        });
      });

      await act(async () => {
        await Promise.all(dismissalPromises);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // All alerts should be consistently dismissed in both tabs
      alerts.forEach(alert => {
        const feedback1 = groupingManager1.getDismissalFeedback(alert.id);
        const feedback2 = groupingManager2.getDismissalFeedback(alert.id);
        
        expect(feedback1?.canDismiss).toBe(false);
        expect(feedback2?.canDismiss).toBe(false);
      });
    });
  });

  describe('localStorage Event Synchronization', () => {
    it('should sync through localStorage events when other methods fail', async () => {
      // Disable BroadcastChannel and SharedWorker
      Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
      Object.defineProperty(window, 'SharedWorker', { value: undefined });

      const fallbackManager1 = new EnhancedAlertGroupingManager();
      const fallbackManager2 = new EnhancedAlertGroupingManager();

      await act(async () => {
        await fallbackManager1.dismissAlert('storage-sync-1', 'manual', {
          reason: 'localStorage fallback test',
        });
      });

      // Should trigger storage event
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const feedback = fallbackManager2.getDismissalFeedback('storage-sync-1');
      expect(feedback?.canDismiss).toBe(false);

      // Re-enable for other tests
      Object.defineProperty(window, 'BroadcastChannel', { value: MockBroadcastChannel });
      Object.defineProperty(window, 'SharedWorker', { value: MockSharedWorker });
    });

    it('should handle storage event conflicts', async () => {
      // Simulate conflicting storage updates
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 1000;

      mockLocalStorage.setItem('alert-dismissed-ids', JSON.stringify([
        { id: 'conflict-1', timestamp: timestamp1, user: 'tab1' }
      ]));

      mockLocalStorage.setItem('alert-dismissed-ids', JSON.stringify([
        { id: 'conflict-1', timestamp: timestamp2, user: 'tab2' }
      ]));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should resolve to latest timestamp
      const feedback = groupingManager1.getDismissalFeedback('conflict-1');
      expect(feedback?.canDismiss).toBe(false);
    });

    it('should batch storage updates to prevent event spam', async () => {
      const storageSetSpy = jest.spyOn(mockLocalStorage, 'setItem');

      // Rapidly dismiss multiple alerts
      const rapidDismissals = Array.from({ length: 5 }, (_, i) => 
        groupingManager1.dismissAlert(`rapid-${i}`, 'manual')
      );

      await act(async () => {
        await Promise.all(rapidDismissals);
      });

      // Should batch updates rather than calling setItem 5 times
      expect(storageSetSpy).toHaveBeenCalledTimes(1);

      storageSetSpy.mockRestore();
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve timestamp conflicts correctly', async () => {
      const baseTime = Date.now();

      // Tab 1 dismisses first
      await act(async () => {
        jest.setSystemTime(baseTime);
        await groupingManager1.dismissAlert('timestamp-1', 'manual', {
          reason: 'First dismissal',
        });
      });

      // Tab 2 dismisses later
      await act(async () => {
        jest.setSystemTime(baseTime + 5000);
        await groupingManager2.dismissAlert('timestamp-1', 'manual', {
          reason: 'Second dismissal',
        });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should use the later dismissal
      const action1 = groupingManager1['undoManager'].actions.find(a => 
        a.alertIds.includes('timestamp-1')
      );
      const action2 = groupingManager2['undoManager'].actions.find(a => 
        a.alertIds.includes('timestamp-1')
      );

      expect(action1?.reason).toBe('Second dismissal');
      expect(action2?.reason).toBe('Second dismissal');
    });

    it('should handle user-based conflict resolution', async () => {
      // Admin user dismisses first
      await act(async () => {
        await groupingManager1.dismissAlert('user-conflict-1', 'manual', {
          reason: 'Admin dismissal',
          user: 'admin',
        });
      });

      // Regular user tries to dismiss
      await act(async () => {
        await groupingManager2.dismissAlert('user-conflict-1', 'manual', {
          reason: 'User dismissal',
          user: 'regular-user',
        });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Admin action should take precedence
      const action = groupingManager1['undoManager'].actions.find(a => 
        a.alertIds.includes('user-conflict-1')
      );
      expect(action?.reason).toBe('Admin dismissal');
    });

    it('should merge compatible state changes', async () => {
      // Tab 1 dismisses alert A
      await act(async () => {
        await groupingManager1.dismissAlert('merge-a', 'manual', {
          reason: 'Dismissal A',
        });
      });

      // Tab 2 dismisses alert B
      await act(async () => {
        await groupingManager2.dismissAlert('merge-b', 'manual', {
          reason: 'Dismissal B',
        });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Both tabs should have both dismissals
      expect(groupingManager1.getDismissalFeedback('merge-a')?.canDismiss).toBe(false);
      expect(groupingManager1.getDismissalFeedback('merge-b')?.canDismiss).toBe(false);
      expect(groupingManager2.getDismissalFeedback('merge-a')?.canDismiss).toBe(false);
      expect(groupingManager2.getDismissalFeedback('merge-b')?.canDismiss).toBe(false);
    });
  });

  describe('Tab Focus and Lifecycle Management', () => {
    it('should handle tab visibility changes', async () => {
      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      await act(async () => {
        await groupingManager1.dismissAlert('hidden-tab', 'manual');
      });

      // Should still synchronize even when tab is hidden
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const feedback = groupingManager2.getDismissalFeedback('hidden-tab');
      expect(feedback?.canDismiss).toBe(false);

      // Restore visibility
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
    });

    it('should pause synchronization when tab is inactive', async () => {
      // Simulate tab becoming inactive
      window.dispatchEvent(new Event('blur'));

      const syncSpy = jest.spyOn(MockBroadcastChannel.prototype, 'postMessage');

      await act(async () => {
        await groupingManager1.dismissAlert('inactive-tab', 'manual');
      });

      // Should reduce sync frequency or pause
      expect(syncSpy).toHaveBeenCalledTimes(0);

      // Reactivate tab
      window.dispatchEvent(new Event('focus'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should resume synchronization
      expect(syncSpy).toHaveBeenCalled();

      syncSpy.mockRestore();
    });

    it('should clean up resources on tab close', () => {
      const broadcastCloseSpy = jest.spyOn(MockBroadcastChannel.prototype, 'close');
      const workerCloseSpy = jest.spyOn(MockMessagePort.prototype, 'close');

      // Simulate tab/page unload
      window.dispatchEvent(new Event('beforeunload'));

      expect(broadcastCloseSpy).toHaveBeenCalled();
      expect(workerCloseSpy).toHaveBeenCalled();

      broadcastCloseSpy.mockRestore();
      workerCloseSpy.mockRestore();
    });
  });

  describe('Performance and Optimization', () => {
    it('should throttle sync messages to prevent flooding', async () => {
      const broadcastSpy = jest.spyOn(MockBroadcastChannel.prototype, 'postMessage');

      // Rapidly dismiss many alerts
      const rapidDismissals = Array.from({ length: 20 }, (_, i) => 
        groupingManager1.dismissAlert(`throttle-${i}`, 'manual')
      );

      await act(async () => {
        await Promise.all(rapidDismissals);
      });

      // Should throttle to reasonable number of messages
      expect(broadcastSpy).toHaveBeenCalledTimes(1); // Batched into single message

      broadcastSpy.mockRestore();
    });

    it('should implement priority-based synchronization', async () => {
      const broadcastSpy = jest.spyOn(MockBroadcastChannel.prototype, 'postMessage');

      // Critical alert should sync immediately
      await act(async () => {
        await groupingManager1.dismissAlert('priority-critical', 'manual', {
          priority: 'critical',
        });
      });

      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      broadcastSpy.mockClear();

      // Info alert can be batched
      await act(async () => {
        await groupingManager1.dismissAlert('priority-info', 'manual', {
          priority: 'info',
        });
      });

      // May not sync immediately
      expect(broadcastSpy).toHaveBeenCalledTimes(0);

      broadcastSpy.mockRestore();
    });

    it('should handle high-frequency updates efficiently', async () => {
      const startTime = performance.now();

      // Generate high-frequency updates
      const updates = Array.from({ length: 100 }, (_, i) => 
        groupingManager1.dismissAlert(`freq-${i}`, 'manual')
      );

      await act(async () => {
        await Promise.all(updates);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const endTime = performance.now();

      // Should handle efficiently
      expect(endTime - startTime).toBeLessThan(1000);

      // All updates should eventually sync
      for (let i = 0; i < 100; i++) {
        const feedback = groupingManager2.getDismissalFeedback(`freq-${i}`);
        expect(feedback?.canDismiss).toBe(false);
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle network interruptions gracefully', async () => {
      // Simulate network interruption by breaking BroadcastChannel
      const originalPostMessage = MockBroadcastChannel.prototype.postMessage;
      MockBroadcastChannel.prototype.postMessage = jest.fn(() => {
        throw new Error('Network error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await act(async () => {
        await groupingManager1.dismissAlert('network-error', 'manual');
      });

      // Should handle error gracefully
      expect(consoleSpy).toHaveBeenCalled();

      // Restore network
      MockBroadcastChannel.prototype.postMessage = originalPostMessage;

      // Should resume synchronization
      await act(async () => {
        await groupingManager1.dismissAlert('network-restored', 'manual');
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const feedback = groupingManager2.getDismissalFeedback('network-restored');
      expect(feedback?.canDismiss).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should recover from partial sync failures', async () => {
      // Simulate partial failure where some messages are lost
      let messageCount = 0;
      const originalPostMessage = MockBroadcastChannel.prototype.postMessage;
      MockBroadcastChannel.prototype.postMessage = function(data) {
        messageCount++;
        if (messageCount % 2 === 0) {
          throw new Error('Intermittent failure');
        }
        return originalPostMessage.call(this, data);
      };

      await act(async () => {
        await groupingManager1.dismissAlert('partial-1', 'manual');
        await groupingManager1.dismissAlert('partial-2', 'manual');
        await groupingManager1.dismissAlert('partial-3', 'manual');
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should eventually achieve consistency through retry mechanism
      const feedback1 = groupingManager2.getDismissalFeedback('partial-1');
      const feedback3 = groupingManager2.getDismissalFeedback('partial-3');
      
      expect(feedback1?.canDismiss).toBe(false);
      expect(feedback3?.canDismiss).toBe(false);

      // Restore normal operation
      MockBroadcastChannel.prototype.postMessage = originalPostMessage;
    });

    it('should maintain data integrity under concurrent modifications', async () => {
      // Simulate concurrent modifications from multiple tabs
      const concurrentOperations = [
        () => groupingManager1.dismissAlert('concurrent-1', 'manual', { user: 'tab1' }),
        () => groupingManager2.dismissAlert('concurrent-1', 'manual', { user: 'tab2' }),
        () => groupingManager1.dismissAlert('concurrent-2', 'bulk', { user: 'tab1' }),
        () => groupingManager2.dismissAlert('concurrent-3', 'manual', { user: 'tab2' }),
      ];

      await act(async () => {
        await Promise.all(concurrentOperations.map(op => op()));
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // State should be consistent across tabs
      ['concurrent-1', 'concurrent-2', 'concurrent-3'].forEach(id => {
        const feedback1 = groupingManager1.getDismissalFeedback(id);
        const feedback2 = groupingManager2.getDismissalFeedback(id);
        
        expect(feedback1?.canDismiss).toBe(feedback2?.canDismiss);
      });
    });
  });

  describe('Integration with UI Components', () => {
    it('should reflect cross-tab changes in UI components', async () => {
      const { rerender } = render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Dismiss alert from another tab
      await act(async () => {
        await groupingManager1.dismissAlert('ui-sync-1', 'manual');
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // UI should update to reflect the change
      rerender(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Alert should not be visible in the UI
      expect(screen.queryByText('ui-sync-1')).not.toBeInTheDocument();
    });

    it('should show sync status indicators', () => {
      render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Should show sync status
      const syncIndicator = screen.getByTestId('sync-status');
      expect(syncIndicator).toBeInTheDocument();
      expect(syncIndicator).toHaveClass('sync-connected');
    });

    it('should handle sync conflicts in UI gracefully', async () => {
      render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Simulate sync conflict
      await act(async () => {
        await groupingManager1.dismissAlert('ui-conflict', 'manual', { user: 'user1' });
        await groupingManager2.dismissAlert('ui-conflict', 'manual', { user: 'user2' });
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Should show conflict resolution notification
      expect(screen.getByText(/sync conflict resolved/i)).toBeInTheDocument();
    });
  });
});