import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { PriorityAlert } from './PriorityAlert';
import { themes } from '../../../../theme/themes';

const renderWithTheme = (ui: React.ReactElement, themeName: keyof typeof themes = 'default') => {
  return render(
    <ThemeProvider initialTheme={themeName}>
      {ui}
    </ThemeProvider>
  );
};

describe('PriorityAlert', () => {
  const defaultProps = {
    priority: 'medium' as const,
    message: 'Test alert message',
  };

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      renderWithTheme(<PriorityAlert {...defaultProps} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Test alert message')).toBeInTheDocument();
    });

    it('renders with title', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} title="Alert Title" />
      );
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
    });

    it('renders with timestamp', () => {
      const timestamp = new Date('2024-01-15T10:30:00');
      renderWithTheme(
        <PriorityAlert {...defaultProps} timestamp={timestamp} />
      );
      expect(screen.getByText('10:30:00 AM')).toBeInTheDocument();
    });

    it('renders with custom icon', () => {
      const customIcon = <span data-testid="custom-icon">🚀</span>;
      renderWithTheme(
        <PriorityAlert {...defaultProps} icon={customIcon} />
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('renders without icon when icon is false', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} icon={false} />
      );
      expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    });
  });

  describe('Priority Levels', () => {
    const priorities = ['critical', 'high', 'medium', 'low', 'info'] as const;

    priorities.forEach((priority) => {
      it(`renders with ${priority} priority`, () => {
        renderWithTheme(
          <PriorityAlert message="Test message" priority={priority} />
        );
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('data-priority', priority);
        
        // Critical alerts should have assertive aria-live
        if (priority === 'critical') {
          expect(alert).toHaveAttribute('aria-live', 'assertive');
        } else {
          expect(alert).toHaveAttribute('aria-live', 'polite');
        }
      });
    });
  });

  describe('Interactivity', () => {
    it('renders close button when closable', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} closable />
      );
      expect(screen.getByLabelText('Close alert')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      renderWithTheme(
        <PriorityAlert {...defaultProps} closable onClose={onClose} />
      );
      
      fireEvent.click(screen.getByLabelText('Close alert'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders action buttons', () => {
      const action = (
        <button onClick={() => {}}>View Details</button>
      );
      renderWithTheme(
        <PriorityAlert {...defaultProps} action={action} />
      );
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    const testThemes = ['default', 'dark', 'highContrast', 'missionCritical'] as const;

    testThemes.forEach((themeName) => {
      it(`renders correctly in ${themeName} theme`, () => {
        renderWithTheme(
          <PriorityAlert {...defaultProps} priority="critical" />,
          themeName
        );
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        
        // Alert should have proper structure regardless of theme
        expect(screen.getByText('Test alert message')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} />
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-atomic', 'true');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('uses assertive aria-live for critical alerts', () => {
      renderWithTheme(
        <PriorityAlert message="Critical message" priority="critical" />
      );
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });

    it('marks icons as decorative', () => {
      renderWithTheme(<PriorityAlert {...defaultProps} />);
      const icon = screen.getByRole('alert').querySelector('.alert-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('provides accessible time format', () => {
      const timestamp = new Date('2024-01-15T10:30:00');
      renderWithTheme(
        <PriorityAlert {...defaultProps} timestamp={timestamp} />
      );
      const timeElement = screen.getByText('10:30:00 AM');
      expect(timeElement.tagName).toBe('TIME');
      expect(timeElement).toHaveAttribute('datetime', timestamp.toISOString());
    });
  });

  describe('Persistence', () => {
    it('sets data-persistent attribute when persistent', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} persistent />
      );
      expect(screen.getByRole('alert')).toHaveAttribute('data-persistent', 'true');
    });

    it('sets data-persistent to false when not persistent', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} persistent={false} />
      );
      expect(screen.getByRole('alert')).toHaveAttribute('data-persistent', 'false');
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} className="custom-alert" />
      );
      expect(screen.getByRole('alert')).toHaveClass('custom-alert');
    });

    it('applies testId', () => {
      renderWithTheme(
        <PriorityAlert {...defaultProps} testId="test-alert" />
      );
      expect(screen.getByTestId('test-alert')).toBeInTheDocument();
    });
  });
});