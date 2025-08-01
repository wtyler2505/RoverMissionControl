/**
 * Comprehensive Tests for Persistence of Dismissal States
 * Tests localStorage, sessionStorage, IndexedDB persistence, and state recovery
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
  DismissalAction,
  AlertGroup 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import { EnhancedAlertContainer } from '../EnhancedAlertContainer';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  databases: new Map(),
};

// Mock IDBDatabase
const mockIDBDatabase = {
  createObjectStore: jest.fn(),
  transaction: jest.fn(),
  close: jest.fn(),
};

// Mock IDBTransaction and IDBObjectStore
const mockIDBObjectStore = {
  add: jest.fn(),
  put: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  getAll: jest.fn(),
};

const mockIDBTransaction = {
  objectStore: jest.fn(() => mockIDBObjectStore),
  oncomplete: null,
  onerror: null,
};

// Setup IndexedDB mocks
Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
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
  message: string,
  options?: {
    persistent?: boolean;
    metadata?: Record<string, any>;
  }
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: new Date(),
  processAfter: new Date(),
  metadata: { 
    source: 'test',
    ...options?.metadata 
  },
  data: {
    message,
    title: `Alert ${id}`,
    persistent: options?.persistent,
    closable: true,
  },
});

// Helper to create mock dismissal actions
const createMockDismissalAction = (
  alertIds: string[],
  options?: {
    type?: 'manual' | 'bulk' | 'timed';
    reason?: string;
    user?: string;
  }
): DismissalAction => ({
  type: options?.type || 'manual',
  alertIds,
  timestamp: new Date(),
  user: options?.user || 'test-user',
  reason: options?.reason,
  undoable: true,
  undoExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
});

describe('Dismissal State Persistence', () => {
  let groupingManager: EnhancedAlertGroupingManager;

  beforeEach(() => {
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    // Clear all mocks
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockSessionStorage.getItem.mockReturnValue(null);
    mockIDBObjectStore.get.mockResolvedValue(undefined);
    mockIDBObjectStore.getAll.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('LocalStorage Persistence', () => {
    it('should save dismissed alert IDs to localStorage', async () => {
      const alerts = [
        createMockAlert('ls-1', 'medium', 'LocalStorage test 1'),
        createMockAlert('ls-2', 'medium', 'LocalStorage test 2'),
      ];

      await act(async () => {
        await groupingManager.dismissAlert('ls-1', 'manual', { 
          reason: 'Test dismissal' 
        });
        await groupingManager.dismissAlert('ls-2', 'manual', { 
          reason: 'Another test' 
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alert-dismissed-ids',
        expect.stringContaining('ls-1')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'alert-dismissed-ids',
        expect.stringContaining('ls-2')
      );
    });

    it('should restore dismissed alert states from localStorage on initialization', async () => {
      const dismissedIds = ['restored-1', 'restored-2', 'restored-3'];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(dismissedIds));

      const newManager = new EnhancedAlertGroupingManager();

      // Wait for async initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Check that dismissed IDs were restored
      const feedback1 = newManager.getDismissalFeedback('restored-1');
      expect(feedback1?.canDismiss).toBe(false);
      expect(feedback1?.reason).toContain('already dismissed');
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json-data');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should not crash and should use default state
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to restore dismissed alerts')
      );

      consoleSpy.mockRestore();
    });

    it('should clean up expired dismissed alert IDs from localStorage', async () => {
      const currentTime = Date.now();
      const expiredData = {
        dismissedIds: ['expired-1', 'expired-2'],
        expiredAt: currentTime - (24 * 60 * 60 * 1000), // 1 day ago
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredData));

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should have cleared expired data
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('alert-dismissed-ids');
    });

    it('should limit localStorage usage to prevent quota exceeded errors', async () => {
      const largeNumberOfDismissals = Array.from({ length: 1000 }, (_, i) => `large-${i}`);

      for (const alertId of largeNumberOfDismissals) {
        await act(async () => {
          await groupingManager.dismissAlert(alertId, 'manual');
        });
      }

      // Should implement some form of cleanup or limiting
      const setItemCalls = mockLocalStorage.setItem.mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const storedData = JSON.parse(lastCall[1]);
      
      // Should not exceed reasonable limits (e.g., 500 dismissed IDs)
      expect(storedData.length).toBeLessThanOrEqual(500);
    });
  });

  describe('SessionStorage Persistence', () => {
    it('should save temporary dismissal states to sessionStorage', async () => {
      const alerts = [
        createMockAlert('ss-1', 'info', 'SessionStorage test'),
      ];

      await act(async () => {
        await groupingManager.dismissAlert('ss-1', 'manual', { 
          temporary: true,
          reason: 'Temporary dismissal' 
        });
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'alert-temp-dismissed',
        expect.stringContaining('ss-1')
      );
    });

    it('should restore temporary dismissals from sessionStorage', async () => {
      const tempDismissed = {
        'temp-1': { dismissedAt: Date.now(), reason: 'Temporary' },
      };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(tempDismissed));

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const feedback = newManager.getDismissalFeedback('temp-1');
      expect(feedback?.canDismiss).toBe(false);
    });

    it('should clear sessionStorage on tab close', () => {
      // Simulate beforeunload event
      const beforeUnloadEvent = new Event('beforeunload');
      window.dispatchEvent(beforeUnloadEvent);

      expect(mockSessionStorage.clear).toHaveBeenCalled();
    });
  });

  describe('IndexedDB Persistence', () => {
    beforeEach(() => {
      // Setup IndexedDB success mocks
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: mockIDBDatabase,
        };
        
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: mockIDBDatabase } });
        }, 0);
        
        return request;
      });

      mockIDBDatabase.transaction.mockReturnValue(mockIDBTransaction);
    });

    it('should save dismissal actions to IndexedDB', async () => {
      const action = createMockDismissalAction(['idb-1', 'idb-2'], {
        type: 'bulk',
        reason: 'Bulk dismissal test',
        user: 'admin',
      });

      await act(async () => {
        await groupingManager.bulkDismiss(
          { alertIds: ['idb-1', 'idb-2'] },
          'bulk',
          { reason: 'Bulk dismissal test', user: 'admin' }
        );
      });

      await waitFor(() => {
        expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'bulk',
            alertIds: ['idb-1', 'idb-2'],
            reason: 'Bulk dismissal test',
          })
        );
      });
    });

    it('should restore dismissal history from IndexedDB', async () => {
      const storedActions = [
        {
          id: 'action-1',
          type: 'manual',
          alertIds: ['restored-1'],
          timestamp: new Date().toISOString(),
          reason: 'Restored action',
        },
      ];

      mockIDBObjectStore.getAll.mockResolvedValue(storedActions);

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should have restored the action
      expect(newManager['undoManager'].actions).toHaveLength(1);
      expect(newManager['undoManager'].actions[0].reason).toBe('Restored action');
    });

    it('should handle IndexedDB quota exceeded errors', async () => {
      mockIDBObjectStore.put.mockRejectedValue(
        new DOMException('QuotaExceededError', 'QuotaExceededError')
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await act(async () => {
        await groupingManager.dismissAlert('quota-test', 'manual', {
          reason: 'Quota test',
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('IndexedDB quota exceeded')
      );

      consoleSpy.mockRestore();
    });

    it('should implement cleanup for old dismissal records', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30); // 30 days ago

      const oldActions = [
        {
          id: 'old-action',
          timestamp: oldDate.toISOString(),
          alertIds: ['old-alert'],
        },
      ];

      mockIDBObjectStore.getAll.mockResolvedValue(oldActions);

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should have cleaned up old records
      expect(mockIDBObjectStore.delete).toHaveBeenCalledWith('old-action');
    });

    it('should fall back to localStorage when IndexedDB is unavailable', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        
        setTimeout(() => {
          if (request.onerror) request.onerror(new Error('IndexedDB not available'));
        }, 0);
        
        return request;
      });

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await groupingManager.dismissAlert('fallback-test', 'manual');
      });

      // Should fall back to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('State Synchronization', () => {
    it('should sync dismissal states across storage mechanisms', async () => {
      await act(async () => {
        await groupingManager.dismissAlert('sync-test', 'manual', {
          reason: 'Sync test',
          persistent: true,
        });
      });

      // Should save to both localStorage and IndexedDB
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(mockIDBObjectStore.put).toHaveBeenCalled();
      });
    });

    it('should handle conflicts between storage mechanisms', async () => {
      // Setup conflicting data
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(['conflict-1']));
      mockIDBObjectStore.getAll.mockResolvedValue([
        {
          id: 'conflict-action',
          alertIds: ['conflict-1'],
          timestamp: new Date(Date.now() + 1000).toISOString(), // Newer
        }
      ]);

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should resolve conflict by using newer timestamp
      const feedback = newManager.getDismissalFeedback('conflict-1');
      expect(feedback?.canDismiss).toBe(false);
    });

    it('should prioritize different storage types appropriately', async () => {
      // Critical alerts should prefer IndexedDB for durability
      await act(async () => {
        await groupingManager.dismissAlert('critical-persist', 'manual', {
          priority: 'critical',
          reason: 'Critical dismissal',
        });
      });

      // Info alerts can use sessionStorage for temporary dismissal
      await act(async () => {
        await groupingManager.dismissAlert('info-temp', 'manual', {
          priority: 'info',
          temporary: true,
        });
      });

      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          alertIds: expect.arrayContaining(['critical-persist'])
        })
      );

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'alert-temp-dismissed',
        expect.stringContaining('info-temp')
      );
    });
  });

  describe('State Recovery and Validation', () => {
    it('should validate restored dismissal states', async () => {
      const invalidData = [
        {
          // Missing required fields
          alertIds: ['invalid-1'],
        },
        {
          type: 'manual',
          alertIds: ['valid-1'],
          timestamp: new Date().toISOString(),
        },
      ];

      mockIDBObjectStore.getAll.mockResolvedValue(invalidData);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should only restore valid entries
      expect(newManager['undoManager'].actions).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid dismissal action')
      );

      consoleSpy.mockRestore();
    });

    it('should handle partial state recovery gracefully', async () => {
      // Simulate partial failure in restoration
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'alert-dismissed-ids') {
          throw new Error('localStorage read error');
        }
        return null;
      });

      mockIDBObjectStore.getAll.mockResolvedValue([
        {
          id: 'partial-1',
          type: 'manual',
          alertIds: ['partial-alert'],
          timestamp: new Date().toISOString(),
        },
      ]);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should still function with partial recovery
      expect(newManager['undoManager'].actions).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should migrate data from old storage formats', async () => {
      // Simulate old format data
      const oldFormatData = {
        version: 1,
        dismissed: ['old-1', 'old-2'],
        actions: [
          ['old-1', 'manual', Date.now()], // Old array format
        ],
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(oldFormatData));

      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should migrate to new format
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('alert-'),
        expect.stringMatching(/version.*2/)
      );
    });
  });

  describe('Performance and Memory Management', () => {
    it('should implement memory limits for in-memory state', async () => {
      const largeManager = new EnhancedAlertGroupingManager({
        undoHistorySize: 5, // Small limit for testing
      });

      // Add more actions than the limit
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await largeManager.dismissAlert(`memory-${i}`, 'manual');
        });
      }

      // Should respect memory limits
      expect(largeManager['undoManager'].actions.length).toBeLessThanOrEqual(5);
    });

    it('should implement lazy loading for large dismissal histories', async () => {
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-${i}`,
        type: 'manual',
        alertIds: [`alert-${i}`],
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      }));

      mockIDBObjectStore.getAll.mockResolvedValue(largeHistory);

      const startTime = performance.now();
      const newManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const endTime = performance.now();

      // Should load efficiently without blocking
      expect(endTime - startTime).toBeLessThan(500); // 500ms threshold

      // Should only load recent actions initially
      expect(newManager['undoManager'].actions.length).toBeLessThanOrEqual(50);
    });

    it('should clean up memory on component unmount', () => {
      const { unmount } = render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      unmount();

      // Should have cleaned up timers and references
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('Cross-Session Persistence', () => {
    it('should maintain dismissal states across browser sessions', async () => {
      // First session
      const session1Manager = new EnhancedAlertGroupingManager();
      
      await act(async () => {
        await session1Manager.dismissAlert('cross-session-1', 'manual', {
          reason: 'Cross-session test',
        });
      });

      // Simulate new session
      const session2Manager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should remember dismissal from previous session
      const feedback = session2Manager.getDismissalFeedback('cross-session-1');
      expect(feedback?.canDismiss).toBe(false);
    });

    it('should handle storage corruption between sessions', async () => {
      mockLocalStorage.getItem.mockReturnValue('corrupted-data');
      mockIDBObjectStore.getAll.mockRejectedValue(new Error('Database corrupted'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const resilientManager = new EnhancedAlertGroupingManager();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should initialize with clean state
      expect(resilientManager['undoManager'].actions).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should provide state export and import functionality', async () => {
      await act(async () => {
        await groupingManager.dismissAlert('export-test', 'manual', {
          reason: 'Export test',
        });
      });

      // Export state
      const exportedState = await groupingManager.exportState();
      expect(exportedState).toMatchObject({
        version: expect.any(String),
        dismissedAlerts: expect.any(Array),
        dismissalActions: expect.any(Array),
        exportedAt: expect.any(String),
      });

      // Import to new manager
      const newManager = new EnhancedAlertGroupingManager();
      await act(async () => {
        await newManager.importState(exportedState);
      });

      // Should have imported the state
      const feedback = newManager.getDismissalFeedback('export-test');
      expect(feedback?.canDismiss).toBe(false);
    });
  });
});