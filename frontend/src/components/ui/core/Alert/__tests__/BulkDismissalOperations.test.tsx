/**
 * Comprehensive Tests for Bulk Dismissal Operations and Filtering
 * Tests BulkDismissalManager functionality, filtering capabilities, and batch operations
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { themes } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { EnhancedAlertGroupingManager, DismissalType, AlertGroup } from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import BulkDismissalManager from '../components/BulkDismissalManager';

// Mock ResizeObserver for testing
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

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
    title?: string;
    source?: string;
    groupId?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  }
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: options?.timestamp || new Date(),
  processAfter: new Date(),
  metadata: { 
    source: options?.source || 'test',
    ...options?.metadata 
  },
  data: {
    message,
    title: options?.title || `Alert ${id}`,
    groupId: options?.groupId,
    closable: true,
  },
});

// Helper to create mock alert groups
const createMockGroup = (
  id: string,
  alerts: ProcessedAlert[],
  options?: {
    groupType?: 'automatic' | 'manual' | 'conditional';
    commonPriority?: AlertPriority;
    commonSource?: string;
  }
): AlertGroup => ({
  id,
  groupKey: `group-${id}`,
  alerts,
  primaryAlert: alerts[0],
  groupType: options?.groupType || 'automatic',
  createdAt: new Date(),
  lastUpdated: new Date(),
  commonPriority: options?.commonPriority || alerts[0].priority,
  commonSource: options?.commonSource,
  similarityScore: 0.8,
  groupingCriteria: ['identical-content'],
  dismissalState: {
    isDismissed: false,
    undoable: true,
  },
});

describe('Bulk Dismissal Operations', () => {
  let mockOnBulkDismiss: jest.Mock;
  let mockOnClose: jest.Mock;
  let groupingManager: EnhancedAlertGroupingManager;
  let testAlerts: ProcessedAlert[];
  let testGroups: AlertGroup[];

  beforeEach(() => {
    mockOnBulkDismiss = jest.fn().mockResolvedValue(true);
    mockOnClose = jest.fn();
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    // Create test data
    testAlerts = [
      createMockAlert('1', 'critical', 'Critical system error'),
      createMockAlert('2', 'high', 'High priority warning'),
      createMockAlert('3', 'medium', 'Medium notification'),
      createMockAlert('4', 'low', 'Low priority info'),
      createMockAlert('5', 'info', 'Information message'),
      createMockAlert('6', 'critical', 'Another critical error'),
      createMockAlert('7', 'medium', 'Network timeout', { source: 'network' }),
      createMockAlert('8', 'medium', 'Database error', { source: 'database' }),
    ];

    testGroups = [
      createMockGroup('group1', [testAlerts[0], testAlerts[5]], { 
        commonPriority: 'critical' 
      }),
      createMockGroup('group2', [testAlerts[2], testAlerts[6]], { 
        commonPriority: 'medium' 
      }),
    ];

    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Basic Bulk Dismissal Interface', () => {
    it('should render bulk dismissal manager with available alerts and groups', async () => {
      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Should show the bulk dismissal interface
      expect(screen.getByText('Bulk Dismissal Manager')).toBeInTheDocument();
      
      // Should show counts
      expect(screen.getByText(/8 alerts available/)).toBeInTheDocument();
      expect(screen.getByText(/2 groups available/)).toBeInTheDocument();
    });

    it('should display filter options for alerts', async () => {
      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Should show priority filter
      expect(screen.getByText('Filter by Priority')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();

      // Should show source filter
      expect(screen.getByText('Filter by Source')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('network')).toBeInTheDocument();
      expect(screen.getByText('database')).toBeInTheDocument();
    });

    it('should show dismissal type options', async () => {
      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Manual Dismissal')).toBeInTheDocument();
      expect(screen.getByText('Timed Dismissal')).toBeInTheDocument();
      expect(screen.getByText('Conditional Dismissal')).toBeInTheDocument();
    });
  });

  describe('Filtering Functionality', () => {
    it('should filter alerts by priority', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Filter by critical priority
      const criticalFilter = screen.getByLabelText('Critical');
      await user.click(criticalFilter);

      // Should update the display to show only critical alerts
      await waitFor(() => {
        expect(screen.getByText(/2 alerts selected/)).toBeInTheDocument();
      });

      // Verify the selection includes only critical alerts
      const selectedAlerts = screen.getAllByTestId(/alert-item-/);
      expect(selectedAlerts).toHaveLength(2);
    });

    it('should filter alerts by source', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Filter by network source
      const networkFilter = screen.getByLabelText('network');
      await user.click(networkFilter);

      await waitFor(() => {
        expect(screen.getByText(/1 alert selected/)).toBeInTheDocument();
      });
    });

    it('should support multiple filter combinations', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Filter by medium priority AND test source
      const mediumFilter = screen.getByLabelText('Medium');
      const testSourceFilter = screen.getByLabelText('test');

      await user.click(mediumFilter);
      await user.click(testSourceFilter);

      await waitFor(() => {
        // Should show medium priority alerts from test source
        expect(screen.getByText(/1 alert selected/)).toBeInTheDocument();
      });
    });

    it('should filter by time range', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Create alerts with different timestamps
      const alertsWithTimestamps = [
        createMockAlert('old', 'medium', 'Old alert', { 
          timestamp: new Date('2024-01-01T10:00:00Z') 
        }),
        createMockAlert('recent', 'medium', 'Recent alert', { 
          timestamp: new Date() 
        }),
      ];

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={alertsWithTimestamps}
            availableGroups={[]}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Set time range filter
      const timeRangeSelect = screen.getByLabelText('Time Range');
      await user.selectOptions(timeRangeSelect, 'last-hour');

      await waitFor(() => {
        // Should filter to recent alerts only
        expect(screen.getByText(/1 alert selected/)).toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Apply some filters
      const criticalFilter = screen.getByLabelText('Critical');
      await user.click(criticalFilter);

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);

      await waitFor(() => {
        // Should show all alerts again
        expect(screen.getByText(/8 alerts available/)).toBeInTheDocument();
      });
    });
  });

  describe('Selection Management', () => {
    it('should support individual alert selection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select individual alerts
      const firstAlertCheckbox = screen.getByTestId('alert-checkbox-1');
      const secondAlertCheckbox = screen.getByTestId('alert-checkbox-2');

      await user.click(firstAlertCheckbox);
      await user.click(secondAlertCheckbox);

      expect(screen.getByText(/2 alerts selected/)).toBeInTheDocument();
    });

    it('should support select all functionality', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      expect(screen.getByText(/8 alerts selected/)).toBeInTheDocument();
    });

    it('should support select none functionality', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // First select all
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      // Then select none
      const selectNoneButton = screen.getByRole('button', { name: /select none/i });
      await user.click(selectNoneButton);

      expect(screen.getByText(/0 alerts selected/)).toBeInTheDocument();
    });

    it('should support group selection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select a group
      const groupCheckbox = screen.getByTestId('group-checkbox-group1');
      await user.click(groupCheckbox);

      expect(screen.getByText(/1 group selected/)).toBeInTheDocument();
    });

    it('should handle mixed alert and group selection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select some individual alerts and a group
      const alertCheckbox = screen.getByTestId('alert-checkbox-3');
      const groupCheckbox = screen.getByTestId('group-checkbox-group1');

      await user.click(alertCheckbox);
      await user.click(groupCheckbox);

      expect(screen.getByText(/1 alert selected/)).toBeInTheDocument();
      expect(screen.getByText(/1 group selected/)).toBeInTheDocument();
    });
  });

  describe('Bulk Dismissal Execution', () => {
    it('should execute manual bulk dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select some alerts
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      // Choose manual dismissal
      const manualDismissalOption = screen.getByLabelText('Manual Dismissal');
      await user.click(manualDismissalOption);

      // Add reason
      const reasonInput = screen.getByLabelText(/reason/i);
      await user.type(reasonInput, 'Bulk cleanup of resolved alerts');

      // Execute dismissal
      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      await user.click(dismissButton);

      expect(mockOnBulkDismiss).toHaveBeenCalledWith(
        {
          alertIds: expect.arrayContaining(testAlerts.map(a => a.id)),
          groupIds: expect.arrayContaining(testGroups.map(g => g.id)),
        },
        'manual',
        expect.objectContaining({
          reason: 'Bulk cleanup of resolved alerts',
        })
      );
    });

    it('should execute timed bulk dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select alerts
      const criticalFilter = screen.getByLabelText('Critical');
      await user.click(criticalFilter);

      // Choose timed dismissal
      const timedDismissalOption = screen.getByLabelText('Timed Dismissal');
      await user.click(timedDismissalOption);

      // Set schedule
      const scheduleInput = screen.getByLabelText(/schedule/i);
      await user.clear(scheduleInput);
      await user.type(scheduleInput, '30');

      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      await user.click(dismissButton);

      expect(mockOnBulkDismiss).toHaveBeenCalledWith(
        expect.objectContaining({
          alertIds: expect.any(Array),
        }),
        'timed',
        expect.objectContaining({
          scheduleMs: 30 * 60 * 1000, // 30 minutes
        })
      );
    });

    it('should handle conditional bulk dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select low priority alerts
      const lowPriorityFilter = screen.getByLabelText('Low');
      await user.click(lowPriorityFilter);

      // Choose conditional dismissal
      const conditionalOption = screen.getByLabelText('Conditional Dismissal');
      await user.click(conditionalOption);

      // Set conditions
      const conditionSelect = screen.getByLabelText(/condition type/i);
      await user.selectOptions(conditionSelect, 'age-based');

      const ageInput = screen.getByLabelText(/age threshold/i);
      await user.type(ageInput, '60'); // 60 minutes

      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      await user.click(dismissButton);

      expect(mockOnBulkDismiss).toHaveBeenCalledWith(
        expect.any(Object),
        'conditional',
        expect.objectContaining({
          conditionType: 'age-based',
          ageThresholdMinutes: 60,
        })
      );
    });

    it('should validate selections before dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Try to dismiss without selecting anything
      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      expect(dismissButton).toBeDisabled();

      // Select something
      const firstAlertCheckbox = screen.getByTestId('alert-checkbox-1');
      await user.click(firstAlertCheckbox);

      expect(dismissButton).toBeEnabled();
    });
  });

  describe('Advanced Filtering Options', () => {
    it('should filter by alert content/message', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Use search filter
      const searchInput = screen.getByPlaceholderText(/search alerts/i);
      await user.type(searchInput, 'critical');

      await waitFor(() => {
        expect(screen.getByText(/2 alerts selected/)).toBeInTheDocument();
      });
    });

    it('should filter by dismissal eligibility', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Filter by dismissible alerts only
      const dismissibleOnlyFilter = screen.getByLabelText('Dismissible Only');
      await user.click(dismissibleOnlyFilter);

      // Should filter out alerts that cannot be dismissed
      await waitFor(() => {
        const visibleAlerts = screen.getAllByTestId(/alert-item-/);
        expect(visibleAlerts.length).toBeLessThanOrEqual(testAlerts.length);
      });
    });

    it('should provide preset filter combinations', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Use "High Priority and Above" preset
      const presetSelect = screen.getByLabelText(/filter preset/i);
      await user.selectOptions(presetSelect, 'high-and-above');

      await waitFor(() => {
        // Should select critical and high priority alerts
        expect(screen.getByText(/3 alerts selected/)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of alerts efficiently', async () => {
      const largeAlertSet = Array.from({ length: 1000 }, (_, i) =>
        createMockAlert(`large-${i}`, 'medium', `Alert ${i}`)
      );

      const startTime = Date.now();

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={largeAlertSet}
            availableGroups={[]}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const endTime = Date.now();

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds

      // Should show correct count
      expect(screen.getByText(/1000 alerts available/)).toBeInTheDocument();
    });

    it('should handle rapid filter changes efficiently', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const startTime = Date.now();

      // Rapidly change filters
      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
      
      for (const priority of priorities) {
        const filter = screen.getByLabelText(priority.charAt(0).toUpperCase() + priority.slice(1));
        await user.click(filter);
        
        // Immediately deselect
        await user.click(filter);
      }

      const endTime = Date.now();

      // Should handle rapid changes efficiently
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should virtualize large lists for performance', async () => {
      const veryLargeAlertSet = Array.from({ length: 5000 }, (_, i) =>
        createMockAlert(`xl-${i}`, 'medium', `Alert ${i}`)
      );

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={veryLargeAlertSet}
            availableGroups={[]}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Should only render visible items in DOM (not all 5000)
      const renderedItems = screen.getAllByTestId(/alert-item-/);
      expect(renderedItems.length).toBeLessThan(100); // Should virtualize
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle bulk dismissal failures gracefully', async () => {
      const failingBulkDismiss = jest.fn().mockRejectedValue(new Error('Bulk dismissal failed'));
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={failingBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select alerts and attempt dismissal
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      await user.click(dismissButton);

      await waitFor(() => {
        expect(failingBulkDismiss).toHaveBeenCalled();
      });

      // Should show error message
      expect(screen.getByText(/bulk dismissal failed/i)).toBeInTheDocument();

      // UI should remain functional
      expect(dismissButton).not.toHaveAttribute('disabled');

      consoleSpy.mockRestore();
    });

    it('should handle empty alert and group arrays', () => {
      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={[]}
            availableGroups={[]}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByText('No alerts available')).toBeInTheDocument();
      expect(screen.getByText('No groups available')).toBeInTheDocument();
    });

    it('should handle malformed alert data', () => {
      const malformedAlerts = [
        {
          id: 'malformed',
          priority: 'invalid' as AlertPriority,
          data: null,
        } as ProcessedAlert,
      ];

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={malformedAlerts}
            availableGroups={[]}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Should handle gracefully without crashing
      expect(screen.getByTestId('test-wrapper')).toBeInTheDocument();
    });

    it('should validate dismissal permissions', async () => {
      const restrictedAlerts = [
        createMockAlert('restricted', 'critical', 'Restricted alert'),
      ];

      // Mock grouping manager to return restricted dismissal feedback
      const restrictedGroupingManager = {
        ...groupingManager,
        getDismissalFeedback: jest.fn().mockReturnValue({
          canDismiss: false,
          reason: 'Administrator permission required',
          behavior: 'persistent',
        }),
      } as any;

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={restrictedGroupingManager}
            availableAlerts={restrictedAlerts}
            availableGroups={[]}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Select the restricted alert
      const alertCheckbox = screen.getByTestId('alert-checkbox-restricted');
      await user.click(alertCheckbox);

      // Should show warning about permissions
      expect(screen.getByText(/administrator permission required/i)).toBeInTheDocument();

      // Dismiss button should be disabled or show warning
      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      expect(dismissButton).toBeDisabled();
    });
  });

  describe('Accessibility and Usability', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      // Should be able to navigate with Tab
      const firstCheckbox = screen.getByTestId('alert-checkbox-1');
      firstCheckbox.focus();

      await user.keyboard('{Space}');
      expect(firstCheckbox).toBeChecked();

      await user.keyboard('{Tab}');
      const nextCheckbox = screen.getByTestId('alert-checkbox-2');
      expect(nextCheckbox).toHaveFocus();
    });

    it('should provide proper ARIA labels', () => {
      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Bulk Dismissal Manager')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by Priority')).toBeInTheDocument();
      expect(screen.getByLabelText('Select all alerts')).toBeInTheDocument();
    });

    it('should announce selection changes to screen readers', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={testAlerts}
            availableGroups={testGroups}
            onBulkDismiss={mockOnBulkDismiss}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      // Should have live region announcing the change
      expect(screen.getByRole('status')).toHaveTextContent(/8 alerts selected/);
    });
  });
});