/**
 * Accessibility Tests for Privacy Controls
 * Comprehensive testing of WCAG 2.1 AA compliance features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@emotion/react';
import { FocusManagementProvider } from '../../../contexts/FocusManagementContext';
import { AccessiblePrivacyControls } from '../AccessiblePrivacyControls';
import { AccessibleConsentDialog } from '../AccessibleConsentDialog';
import { AccessiblePrivacyForm } from '../AccessiblePrivacyForm';
import { lightTheme } from '../../../theme/themes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock consent manager
jest.mock('../../../services/privacy/ConsentManager', () => ({
  consentManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllConsents: jest.fn().mockResolvedValue({
      essential: true,
      analytics: false,
      marketing: false,
      functional: true
    }),
    getAllConsentConfigurations: jest.fn().mockReturnValue([
      {
        category: 'essential',
        name: 'Essential Cookies',
        description: 'Required for basic functionality',
        required: true,
        legalBasis: 'legitimate_interest',
        dataRetentionDays: 365
      },
      {
        category: 'analytics',
        name: 'Analytics Cookies',
        description: 'Help us improve our service',
        required: false,
        legalBasis: 'consent',
        dataRetentionDays: 90
      }
    ]),
    updateConsent: jest.fn().mockResolvedValue(undefined),
    exportConsentData: jest.fn().mockResolvedValue({}),
    withdrawAllConsent: jest.fn().mockResolvedValue(undefined)
  }
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <FocusManagementProvider>
      {children}
    </FocusManagementProvider>
  </ThemeProvider>
);

describe('AccessiblePrivacyControls', () => {
  const mockOnConsentChange = jest.fn();
  const mockOnExportData = jest.fn();
  const mockOnDeleteData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <AccessiblePrivacyControls
            onConsentChange={mockOnConsentChange}
            onExportData={mockOnExportData}
            onDeleteData={mockOnDeleteData}
          />
        </TestWrapper>
      );

      await waitFor(async () => {
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <AccessiblePrivacyControls />
        </TestWrapper>
      );

      await waitFor(() => {
        // Main heading should be h1
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy Settings');
        
        // Section headings should be h2
        expect(screen.getByRole('heading', { level: 2, name: /data collection preferences/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: /data rights/i })).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes', async () => {
      render(
        <TestWrapper>
          <AccessiblePrivacyControls />
        </TestWrapper>
      );

      await waitFor(() => {
        // Main container should have role="main"
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Privacy settings');
        
        // Live region should be present
        expect(screen.getByRole('alert')).toBeInTheDocument();
        
        // Groups should have proper labeling
        const groups = screen.getAllByRole('group');
        groups.forEach(group => {
          expect(group).toHaveAttribute('aria-labelledby');
          expect(group).toHaveAttribute('aria-describedby');
        });
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AccessiblePrivacyControls />
        </TestWrapper>
      );

      await waitFor(async () => {
        // First focusable element should be the main title
        await user.tab();
        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();

        // Should be able to tab to section headings
        await user.tab();
        expect(screen.getByRole('heading', { level: 2, name: /data collection preferences/i })).toHaveFocus();

        // Should be able to tab to toggle switches
        await user.tab();
        const toggles = screen.getAllByRole('switch');
        expect(toggles[0]).toHaveFocus();
      });
    });

    it('should support Enter and Space key activation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AccessiblePrivacyControls
            onConsentChange={mockOnConsentChange}
          />
        </TestWrapper>
      );

      await waitFor(async () => {
        const toggle = screen.getAllByRole('switch')[1]; // Non-required toggle
        await user.click(toggle);
        await user.keyboard('{Space}');
        
        expect(mockOnConsentChange).toHaveBeenCalled();
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce consent changes', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AccessiblePrivacyControls
            onConsentChange={mockOnConsentChange}
          />
        </TestWrapper>
      );

      await waitFor(async () => {
        const toggle = screen.getAllByRole('switch')[1]; // Non-required toggle
        await user.click(toggle);
        
        // Live region should contain announcement
        const liveRegion = screen.getByRole('alert');
        expect(liveRegion).toBeInTheDocument();
      });
    });

    it('should have proper form labels and descriptions', async () => {
      render(
        <TestWrapper>
          <AccessiblePrivacyControls />
        </TestWrapper>
      );

      await waitFor(() => {
        const toggles = screen.getAllByRole('switch');
        
        toggles.forEach(toggle => {
          // Each toggle should have a label
          const label = toggle.getAttribute('aria-label') || 
                       toggle.getAttribute('aria-labelledby');
          expect(label).toBeTruthy();

          // Each toggle should have description
          const description = toggle.getAttribute('aria-describedby');
          expect(description).toBeTruthy();
        });
      });
    });
  });

  describe('High Contrast Mode', () => {
    it('should apply high contrast styles when enabled', async () => {
      render(
        <TestWrapper>
          <AccessiblePrivacyControls highContrastMode={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        const container = screen.getByRole('main');
        expect(container).toHaveStyle({
          border: expect.stringContaining('2px solid')
        });
      });
    });

    it('should maintain functionality in high contrast mode', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AccessiblePrivacyControls
            highContrastMode={true}
            onConsentChange={mockOnConsentChange}
          />
        </TestWrapper>
      );

      await waitFor(async () => {
        const toggle = screen.getAllByRole('switch')[1];
        await user.click(toggle);
        
        expect(mockOnConsentChange).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should announce errors to screen readers', async () => {
      // Mock an error
      const mockConsentManager = require('../../../services/privacy/ConsentManager');
      mockConsentManager.consentManager.getAllConsents.mockRejectedValueOnce(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <AccessiblePrivacyControls />
        </TestWrapper>
      );

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/failed to load privacy settings/i);
      });
    });
  });

  describe('Verbose Mode', () => {
    it('should provide additional instructions in verbose mode', async () => {
      render(
        <TestWrapper>
          <AccessiblePrivacyControls verboseMode={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/use tab key to navigate/i)).toBeInTheDocument();
      });
    });
  });
});

describe('AccessibleConsentDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConsentUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <TestWrapper>
        <AccessibleConsentDialog
          open={true}
          onClose={mockOnClose}
          onConsentUpdate={mockOnConsentUpdate}
        />
      </TestWrapper>
    );

    await waitFor(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it('should trap focus within dialog', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <AccessibleConsentDialog
          open={true}
          onClose={mockOnClose}
          onConsentUpdate={mockOnConsentUpdate}
        />
      </TestWrapper>
    );

    await waitFor(async () => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Tab should cycle within dialog
      await user.tab();
      const firstFocusable = document.activeElement;
      
      // Should contain focus within dialog
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('should close on Escape key', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <AccessibleConsentDialog
          open={true}
          onClose={mockOnClose}
          onConsentUpdate={mockOnConsentUpdate}
        />
      </TestWrapper>
    );

    await waitFor(async () => {
      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});

describe('AccessiblePrivacyForm', () => {
  const mockOnSubmit = jest.fn();
  
  const testFields = [
    {
      name: 'email',
      label: 'Email Address',
      type: 'email' as const,
      required: true,
      validation: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      }
    },
    {
      name: 'consent',
      label: 'I agree to the terms',
      type: 'checkbox' as const,
      required: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <TestWrapper>
        <AccessiblePrivacyForm
          fields={testFields}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should display accessible error summary', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <AccessiblePrivacyForm
          fields={testFields}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    );

    // Submit form without filling required fields
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    await waitFor(() => {
      // Error summary should appear and receive focus
      const errorSummary = screen.getByRole('alert');
      expect(errorSummary).toHaveTextContent(/error/i);
      expect(errorSummary).toHaveFocus();
    });
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <AccessiblePrivacyForm
          fields={testFields}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Trigger blur validation

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });
});