/**
 * RichContentContainer Tests
 * Comprehensive testing for rich content rendering and security
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { defaultTheme } from '../../../../theme/themes';
import { RichContentContainer } from './components/RichContentContainer';
import { RichContent, RichContentConfig } from './types/RichContentTypes';

// Mock DOMPurify
jest.mock('dompurify', () => ({
  sanitize: jest.fn((html) => html),
  isSupported: true
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={defaultTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('RichContentContainer', () => {
  const defaultConfig: RichContentConfig = {
    maxContentHeight: '400px',
    allowScrolling: true,
    securityPolicy: {
      allowScripts: false,
      allowExternalLinks: true,
      allowFormSubmissions: true,
      allowFileUploads: false
    },
    accessibility: {
      announceChanges: true,
      supportScreenReader: true,
      enforceColorContrast: true,
      requireAltText: true
    }
  };

  describe('Basic Rendering', () => {
    it('renders empty state when no content provided', () => {
      renderWithTheme(
        <RichContentContainer
          content={[]}
          config={defaultConfig}
        />
      );
      
      expect(screen.getByText('No valid content to display')).toBeInTheDocument();
    });

    it('renders security notice when sandbox mode is enabled', () => {
      const content: RichContent[] = [
        {
          id: 'test-text',
          type: 'text',
          securityLevel: 'sanitized',
          content: 'Test content'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={{ ...defaultConfig, sandboxMode: true }}
        />
      );
      
      expect(screen.getByText(/This content is subject to security restrictions/)).toBeInTheDocument();
    });

    it('applies proper ARIA attributes', () => {
      const content: RichContent[] = [
        {
          id: 'test-text',
          type: 'text',
          securityLevel: 'sanitized',
          content: 'Test content'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const container = screen.getByRole('region');
      expect(container).toHaveAttribute('aria-label', 'Rich content');
    });
  });

  describe('Rich Text Content', () => {
    it('renders plain text content safely', () => {
      const content: RichContent[] = [
        {
          id: 'test-text',
          type: 'text',
          securityLevel: 'sanitized',
          content: 'Hello <script>alert("xss")</script> World'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      expect(screen.getByTestId('rich-content-item-test-text')).toBeInTheDocument();
      // Script should be escaped
      expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();
    });

    it('renders markdown content', () => {
      const content: RichContent[] = [
        {
          id: 'test-markdown',
          type: 'markdown',
          securityLevel: 'sanitized',
          content: '# Header\n\n**Bold text** and *italic text*'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const container = screen.getByTestId('rich-content-item-test-markdown');
      expect(container).toBeInTheDocument();
    });

    it('sanitizes HTML content based on security level', () => {
      const content: RichContent[] = [
        {
          id: 'test-html',
          type: 'html',
          securityLevel: 'restricted',
          content: '<script>alert("xss")</script><p>Safe content</p>'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      expect(screen.getByTestId('rich-content-item-test-html')).toBeInTheDocument();
    });
  });

  describe('Image Content', () => {
    it('renders image with proper attributes', () => {
      const content: RichContent[] = [
        {
          id: 'test-image',
          type: 'image',
          securityLevel: 'sanitized',
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Image title'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'Test image');
      expect(image).toHaveAttribute('title', 'Image title');
    });

    it('blocks images in restricted security mode', () => {
      const content: RichContent[] = [
        {
          id: 'test-image',
          type: 'image',
          securityLevel: 'restricted',
          src: 'https://example.com/image.jpg',
          alt: 'Test image'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      expect(screen.getByText(/Image blocked in restricted mode/)).toBeInTheDocument();
    });

    it('validates image URLs', () => {
      const content: RichContent[] = [
        {
          id: 'test-image',
          type: 'image',
          securityLevel: 'sanitized',
          src: 'javascript:alert("xss")',
          alt: 'Test image'
        }
      ];

      const onValidationError = jest.fn();

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
          onValidationError={onValidationError}
        />
      );
      
      expect(onValidationError).toHaveBeenCalledWith(
        'test-image',
        expect.arrayContaining([expect.stringContaining('Invalid or unsafe image URL')])
      );
    });
  });

  describe('Link Content', () => {
    it('renders links with proper security attributes', () => {
      const content: RichContent[] = [
        {
          id: 'test-link',
          type: 'link',
          securityLevel: 'sanitized',
          href: 'https://example.com',
          text: 'External link',
          external: true
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('disables links in restricted security mode', () => {
      const content: RichContent[] = [
        {
          id: 'test-link',
          type: 'link',
          securityLevel: 'restricted',
          href: 'https://example.com',
          text: 'Blocked link'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const container = screen.getByTestId('rich-content-item-test-link');
      expect(container.textContent).toContain('(blocked)');
    });
  });

  describe('Form Content', () => {
    it('renders form with validation', async () => {
      const onSubmit = jest.fn().mockResolvedValue({ success: true });

      const content: RichContent[] = [
        {
          id: 'test-form',
          type: 'form',
          securityLevel: 'sanitized',
          fields: [
            {
              id: 'name',
              name: 'name',
              type: 'text',
              label: 'Name',
              required: true
            }
          ],
          onSubmit
        }
      ];

      const user = userEvent.setup();

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const nameInput = screen.getByLabelText('Name *');
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      expect(nameInput).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
      
      // Test form submission
      await user.type(nameInput, 'John Doe');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
      });
    });

    it('blocks forms in restricted security mode', () => {
      const content: RichContent[] = [
        {
          id: 'test-form',
          type: 'form',
          securityLevel: 'restricted',
          fields: [],
          onSubmit: jest.fn()
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      expect(screen.getByText(/Form blocked in restricted mode/)).toBeInTheDocument();
    });
  });

  describe('Progress Content', () => {
    it('renders progress bar with correct values', () => {
      const content: RichContent[] = [
        {
          id: 'test-progress',
          type: 'progress',
          securityLevel: 'sanitized',
          value: 75,
          max: 100,
          label: 'Loading progress',
          showPercentage: true
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('renders indeterminate progress', () => {
      const content: RichContent[] = [
        {
          id: 'test-progress',
          type: 'progress',
          securityLevel: 'sanitized',
          value: 0,
          indeterminate: true,
          label: 'Loading...'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuetext', 'Loading...');
    });
  });

  describe('Table Content', () => {
    it('renders table with sortable columns', async () => {
      const content: RichContent[] = [
        {
          id: 'test-table',
          type: 'table',
          securityLevel: 'sanitized',
          columns: [
            { id: 'name', label: 'Name', sortable: true },
            { id: 'value', label: 'Value', sortable: true }
          ],
          data: [
            { name: 'Item 1', value: 100 },
            { name: 'Item 2', value: 50 }
          ],
          sortable: true
        }
      ];

      const user = userEvent.setup();

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
      expect(nameHeader).toBeInTheDocument();
      
      // Test sorting
      await user.click(nameHeader);
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('renders searchable table', async () => {
      const content: RichContent[] = [
        {
          id: 'test-table',
          type: 'table',
          securityLevel: 'sanitized',
          columns: [
            { id: 'name', label: 'Name' }
          ],
          data: [
            { name: 'Apple' },
            { name: 'Banana' },
            { name: 'Cherry' }
          ],
          searchable: true
        }
      ];

      const user = userEvent.setup();

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const searchInput = screen.getByPlaceholderText('Search table...');
      expect(searchInput).toBeInTheDocument();
      
      // Test search functionality
      await user.type(searchInput, 'App');
      
      // Should show only Apple
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('calls onContentLoad for each content item', () => {
      const onContentLoad = jest.fn();

      const content: RichContent[] = [
        {
          id: 'test-text',
          type: 'text',
          securityLevel: 'sanitized',
          content: 'Test content'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
          onContentLoad={onContentLoad}
        />
      );
      
      expect(onContentLoad).toHaveBeenCalledWith('test-text');
    });

    it('calls onContentError for invalid content', () => {
      const onContentError = jest.fn();

      const content: RichContent[] = [
        {
          id: 'test-image',
          type: 'image',
          securityLevel: 'sanitized',
          src: 'invalid-url',
          alt: 'Test image'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
          onContentError={onContentError}
        />
      );
      
      expect(onContentError).toHaveBeenCalled();
    });

    it('calls onInteraction for content interactions', async () => {
      const onInteraction = jest.fn();

      const content: RichContent[] = [
        {
          id: 'test-link',
          type: 'link',
          securityLevel: 'sanitized',
          href: 'https://example.com',
          text: 'Test link'
        }
      ];

      const user = userEvent.setup();

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
          onInteraction={onInteraction}
        />
      );
      
      const link = screen.getByRole('link');
      await user.click(link);
      
      expect(onInteraction).toHaveBeenCalledWith(
        'test-link',
        'link-click',
        expect.objectContaining({
          href: 'https://example.com',
          text: 'Test link'
        })
      );
    });
  });

  describe('Security and Validation', () => {
    it('validates content based on security level', () => {
      const onValidationError = jest.fn();

      const content: RichContent[] = [
        {
          id: 'test-component',
          type: 'component',
          securityLevel: 'restricted', // Components not allowed in restricted mode
          component: <div>Custom component</div>
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
          onValidationError={onValidationError}
        />
      );
      
      expect(onValidationError).toHaveBeenCalledWith(
        'test-component',
        expect.arrayContaining([
          expect.stringContaining('not allowed for security level')
        ])
      );
    });

    it('limits content items to maxContentItems', () => {
      const content: RichContent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `test-${i}`,
        type: 'text',
        securityLevel: 'sanitized',
        content: `Content ${i}`
      }));

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
          maxContentItems={5}
        />
      );
      
      // Should only render 5 items
      expect(screen.getAllByTestId(/rich-content-item-/).length).toBe(5);
    });

    it('handles malformed content gracefully', () => {
      const content: RichContent[] = [
        {
          id: 'test-malformed',
          type: 'form',
          securityLevel: 'sanitized',
          fields: [],
          onSubmit: undefined as any // Invalid onSubmit
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      // Should render error message instead of crashing
      expect(screen.getByText(/Content Error/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and descriptions', () => {
      const content: RichContent[] = [
        {
          id: 'test-content',
          type: 'text',
          securityLevel: 'sanitized',
          content: 'Test content',
          ariaLabel: 'Test content area',
          ariaDescription: 'This is a test content area'
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      const contentItem = screen.getByLabelText('Test content area');
      expect(contentItem).toHaveAttribute('aria-describedby', 'This is a test content area');
    });

    it('announces validation warnings', () => {
      const content: RichContent[] = [
        {
          id: 'test-image',
          type: 'image',
          securityLevel: 'sanitized',
          src: 'https://example.com/image.jpg',
          alt: '' // Missing alt text should generate warning
        }
      ];

      renderWithTheme(
        <RichContentContainer
          content={content}
          config={defaultConfig}
        />
      );
      
      // Should show validation warning
      expect(screen.getByText(/validation warnings/)).toBeInTheDocument();
    });
  });
});