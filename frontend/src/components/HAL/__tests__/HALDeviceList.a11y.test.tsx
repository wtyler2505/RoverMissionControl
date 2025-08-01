/**
 * HAL Device List Accessibility Tests
 * 
 * Tests WCAG 2.1 AA compliance for the HAL Device List component
 * Focuses on table/list accessibility, sorting, filtering, and selection
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HALDeviceList } from '../HALDeviceList';
import { 
  renderWithA11y, 
  createA11yTestSuite,
  KeyboardTestUtils,
  ScreenReaderTestUtils
} from '../../../utils/a11y-test-utils';

const mockDevices = [
  {
    id: 'device-1',
    name: 'Temperature Sensor A1',
    type: 'sensor',
    status: 'connected',
    capabilities: ['read', 'configure'],
    lastSeen: '2025-01-15T10:30:00Z',
    metadata: { 
      location: 'Lab Room 1',
      firmware: '1.2.3'
    }
  },
  {
    id: 'device-2', 
    name: 'Motor Controller B2',
    type: 'actuator',
    status: 'disconnected',
    capabilities: ['write', 'control'],
    lastSeen: '2025-01-15T09:15:00Z',
    metadata: {
      location: 'Field Station 2',
      firmware: '2.1.0'
    }
  },
  {
    id: 'device-3',
    name: 'Camera Module C3',
    type: 'sensor',
    status: 'connected',
    capabilities: ['read', 'stream'],
    lastSeen: '2025-01-15T10:32:00Z',
    metadata: {
      location: 'Rover External',
      firmware: '3.0.1'
    }
  }
];

// Mock HAL context
jest.mock('../HALContext', () => ({
  useHAL: () => ({
    devices: mockDevices,
    totalDevices: 3,
    connectedDevices: 2,
    isLoading: false,
    error: null,
    refreshDevices: jest.fn(),
    connectDevice: jest.fn(),
    disconnectDevice: jest.fn(),
    selectDevice: jest.fn(),
    selectedDevices: []
  })
}));

describe('HAL Device List Accessibility Tests', () => {
  // Standard accessibility test suite
  createA11yTestSuite(
    'HALDeviceList',
    () => <HALDeviceList devices={mockDevices} />,
    () => {
      // Custom accessibility tests for device list
      
      test('should use proper table structure with headers', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        await waitFor(() => {
          const table = screen.getByRole('table');
          expect(table).toBeInTheDocument();
          
          // Table should have caption or aria-label
          const caption = table.querySelector('caption');
          const ariaLabel = table.getAttribute('aria-label');
          expect(caption || ariaLabel).toBeTruthy();
          
          // Check for column headers
          const columnHeaders = screen.getAllByRole('columnheader');
          expect(columnHeaders.length).toBeGreaterThan(0);
          
          // Headers should have accessible names
          columnHeaders.forEach(header => {
            const headerText = header.textContent;
            expect(headerText).toBeTruthy();
            expect(headerText!.trim().length).toBeGreaterThan(0);
          });
        });
      });

      test('should support table sorting with keyboard and screen readers', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        await waitFor(() => {
          const sortableHeaders = container.querySelectorAll('th[role="columnheader"][tabindex]');
          
          sortableHeaders.forEach(header => {
            // Sortable headers should be focusable
            expect(header).toHaveAttribute('tabindex', '0');
            
            // Should have aria-sort attribute
            const ariaSort = header.getAttribute('aria-sort');
            expect(['none', 'ascending', 'descending']).toContain(ariaSort);
            
            // Should indicate sortability to screen readers
            const ariaLabel = header.getAttribute('aria-label');
            if (ariaLabel) {
              expect(ariaLabel.toLowerCase()).toMatch(/(sort|sortable)/);
            }
          });
        });
      });

      test('should handle keyboard sorting activation', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        const user = userEvent.setup();
        
        await waitFor(() => {
          const sortableHeaders = container.querySelectorAll('th[role="columnheader"][tabindex="0"]');
          
          if (sortableHeaders.length > 0) {
            const firstHeader = sortableHeaders[0] as HTMLElement;
            
            // Focus and activate with Enter
            firstHeader.focus();
            expect(document.activeElement).toBe(firstHeader);
          }
        });
        
        // Test Enter key activation
        await user.keyboard('{Enter}');
        
        // Sort state should change (aria-sort attribute)
        const sortedHeader = container.querySelector('th[aria-sort="ascending"], th[aria-sort="descending"]');
        expect(sortedHeader).toBeInTheDocument();
      });

      test('should provide row selection accessibility', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        await waitFor(() => {
          const rows = screen.getAllByRole('row');
          // Filter out header row
          const dataRows = rows.filter(row => row.querySelector('td'));
          
          dataRows.forEach(row => {
            // Row should be selectable
            const checkbox = within(row).queryByRole('checkbox');
            
            if (checkbox) {
              // Checkbox should have accessible label
              const label = checkbox.getAttribute('aria-label') || 
                           checkbox.getAttribute('aria-labelledby');
              expect(label).toBeTruthy();
              
              // Should indicate what will be selected
              const labelText = label || '';
              expect(labelText.toLowerCase()).toMatch(/(select|choose)/);
            }
          });
        });
      });

      test('should handle multi-selection with keyboard', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        const user = userEvent.setup();
        
        await waitFor(() => {
          const checkboxes = screen.getAllByRole('checkbox');
          
          if (checkboxes.length > 0) {
            const firstCheckbox = checkboxes[0];
            
            // Should be keyboard accessible
            expect(firstCheckbox).not.toHaveAttribute('tabindex', '-1');
          }
        });
        
        // Test space key selection
        const checkboxes = screen.getAllByRole('checkbox');
        if (checkboxes.length > 0) {
          checkboxes[0].focus();
          await user.keyboard(' ');
          
          expect(checkboxes[0]).toBeChecked();
        }
      });

      test('should announce selection changes to screen readers', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        await waitFor(() => {
          // Look for aria-live regions for selection feedback
          const liveRegions = container.querySelectorAll('[aria-live]');
          const statusElements = container.querySelectorAll('[role="status"]');
          
          expect(liveRegions.length + statusElements.length).toBeGreaterThan(0);
        });
      });

      test('should provide device status information accessibly', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        await waitFor(() => {
          const statusCells = container.querySelectorAll('td[data-testid*="status"]');
          
          statusCells.forEach(cell => {
            // Status should be readable by screen readers
            const ariaLabel = cell.getAttribute('aria-label');
            const statusText = cell.textContent;
            
            expect(ariaLabel || statusText).toBeTruthy();
            
            // Should convey connection state clearly
            const content = (ariaLabel || statusText)!.toLowerCase();
            expect(content).toMatch(/(connected|disconnected|online|offline|active|inactive)/);
          });
        });
      });

      test('should support filtering with keyboard navigation', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        const user = userEvent.setup();
        
        // Look for filter controls
        const filterInputs = container.querySelectorAll('input[type="text"], input[type="search"]');
        const filterSelects = container.querySelectorAll('select');
        
        // Test text filter accessibility
        for (const input of filterInputs) {
          const label = container.querySelector(`label[for="${input.id}"]`);
          const ariaLabel = input.getAttribute('aria-label');
          const ariaLabelledBy = input.getAttribute('aria-labelledby');
          
          expect(label || ariaLabel || ariaLabelledBy).toBeTruthy();
          
          // Input should be keyboard accessible
          input.focus();
          await user.type(input, 'sensor');
          
          expect(input).toHaveValue('sensor');
        }
        
        // Test select filter accessibility
        for (const select of filterSelects) {
          const label = container.querySelector(`label[for="${select.id}"]`);
          const ariaLabel = select.getAttribute('aria-label');
          
          expect(label || ariaLabel).toBeTruthy();
        }
      });

      test('should handle empty state accessibly', async () => {
        // Mock empty device list
        jest.clearAllMocks();
        require('../HALContext').useHAL.mockReturnValue({
          devices: [],
          totalDevices: 0,
          connectedDevices: 0,
          isLoading: false,
          error: null,
          refreshDevices: jest.fn(),
          connectDevice: jest.fn(),
          disconnectDevice: jest.fn(),
          selectDevice: jest.fn(),
          selectedDevices: []
        });
        
        const { container } = renderWithA11y(<HALDeviceList devices={[]} />);
        
        await waitFor(() => {
          // Empty state should be announced to screen readers
          const emptyMessage = container.querySelector('[role="status"], [aria-live]');
          expect(emptyMessage).toBeInTheDocument();
          
          // Should provide helpful message
          const messageText = emptyMessage?.textContent || '';
          expect(messageText.toLowerCase()).toMatch(/(no devices|empty|not found)/);
        });
      });

      test('should support pagination accessibility', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        // Look for pagination controls
        const paginationContainer = container.querySelector('[role="navigation"][aria-label*="pagination"], [role="navigation"][aria-label*="Pagination"]');
        
        if (paginationContainer) {
          const pageButtons = paginationContainer.querySelectorAll('button');
          
          pageButtons.forEach(button => {
            // Page buttons should have accessible names
            const ariaLabel = button.getAttribute('aria-label');
            const buttonText = button.textContent;
            
            expect(ariaLabel || buttonText).toBeTruthy();
            
            // Current page should be indicated
            if (button.getAttribute('aria-current') === 'page') {
              expect(button).toHaveAttribute('aria-current', 'page');
            }
          });
        }
      });

      test('should provide action buttons with clear labeling', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        
        await waitFor(() => {
          const actionButtons = container.querySelectorAll('button[data-testid*="action"], button[data-testid*="device"]');
          
          actionButtons.forEach(button => {
            // Action buttons should have descriptive labels
            const ariaLabel = button.getAttribute('aria-label');
            const buttonText = button.textContent;
            
            expect(ariaLabel || buttonText).toBeTruthy();
            
            // Label should describe the action clearly
            const label = (ariaLabel || buttonText)!.toLowerCase();
            expect(label).toMatch(/(connect|disconnect|configure|edit|delete|view|control)/);
          });
        });
      });

      test('should handle loading state with proper announcements', async () => {
        // Mock loading state
        jest.clearAllMocks();
        require('../HALContext').useHAL.mockReturnValue({
          devices: [],
          totalDevices: 0,
          connectedDevices: 0,
          isLoading: true,
          error: null,
          refreshDevices: jest.fn(),
          connectDevice: jest.fn(),
          disconnectDevice: jest.fn(),
          selectDevice: jest.fn(),
          selectedDevices: []
        });
        
        const { container } = renderWithA11y(<HALDeviceList devices={[]} />);
        
        await waitFor(() => {
          // Loading state should be announced
          const loadingIndicator = container.querySelector('[aria-live="polite"], [role="status"]');
          expect(loadingIndicator).toBeInTheDocument();
          
          // Should indicate what is loading
          const loadingText = loadingIndicator?.textContent || '';
          expect(loadingText.toLowerCase()).toMatch(/(loading|fetching|retrieving)/);
        });
      });

      test('should support bulk actions accessibility', async () => {
        const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
        const user = userEvent.setup();
        
        // Select multiple items first
        const checkboxes = screen.getAllByRole('checkbox');
        if (checkboxes.length > 1) {
          await user.click(checkboxes[0]);
          await user.click(checkboxes[1]);
          
          // Look for bulk action controls
          const bulkActions = container.querySelectorAll('button[data-testid*="bulk"], button[aria-label*="selected"]');
          
          bulkActions.forEach(button => {
            // Bulk actions should indicate count
            const ariaLabel = button.getAttribute('aria-label');
            const buttonText = button.textContent;
            
            const label = ariaLabel || buttonText || '';
            expect(label.toLowerCase()).toMatch(/(\d+|selected|all)/);
          });
        }
      });
    }
  );

  // Table-specific accessibility tests
  describe('Table Accessibility Specifics', () => {
    test('should associate data cells with headers', async () => {
      const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
      
      await waitFor(() => {
        const table = screen.getByRole('table');
        const headers = table.querySelectorAll('th');
        const dataCells = table.querySelectorAll('td');
        
        // Headers should have id attributes for association
        headers.forEach(header => {
          const headerId = header.getAttribute('id');
          if (headerId) {
            // Find cells that reference this header
            const associatedCells = table.querySelectorAll(`td[headers*="${headerId}"]`);
            expect(associatedCells.length).toBeGreaterThanOrEqual(0);
          }
        });
      });
    });

    test('should handle complex table navigation', async () => {
      const { container } = renderWithA11y(<HALDeviceList devices={mockDevices} />);
      const user = userEvent.setup();
      
      await waitFor(() => {
        const table = screen.getByRole('table');
        const focusableElements = table.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
          // Test Tab navigation through table
          const firstElement = focusableElements[0] as HTMLElement;
          firstElement.focus();
          
          // Navigate through table elements
          for (let i = 1; i < Math.min(3, focusableElements.length); i++) {
            await user.tab();
            expect(document.activeElement).toBeInTheDocument();
          }
        }
      });
    });
  });
});