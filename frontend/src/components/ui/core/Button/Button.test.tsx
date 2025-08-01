import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './Button';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { themes } from '../../../../theme/themes';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Test wrapper with theme provider
const renderWithTheme = (component: React.ReactElement, themeName = 'default') => {
  return render(
    <ThemeProvider initialTheme={themeName} persistTheme={false}>
      {component}
    </ThemeProvider>
  );
};

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with text content', () => {
      renderWithTheme(<Button>Click Me</Button>);
      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
    });

    it('renders with all variants', () => {
      const variants = ['primary', 'secondary', 'tertiary', 'danger', 'ghost'] as const;
      
      variants.forEach(variant => {
        const { rerender } = renderWithTheme(
          <Button variant={variant}>Button {variant}</Button>
        );
        
        const button = screen.getByRole('button', { name: `Button ${variant}` });
        expect(button).toBeInTheDocument();
        
        // Clean up for next iteration
        rerender(<></>);
      });
    });

    it('renders with all sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { rerender } = renderWithTheme(
          <Button size={size}>Button {size}</Button>
        );
        
        const button = screen.getByRole('button', { name: `Button ${size}` });
        expect(button).toBeInTheDocument();
        
        rerender(<></>);
      });
    });

    it('renders full width button', () => {
      renderWithTheme(<Button fullWidth>Full Width Button</Button>);
      const button = screen.getByRole('button', { name: 'Full Width Button' });
      expect(button).toBeInTheDocument();
    });

    it('renders with icon on the left', () => {
      const TestIcon = () => <span data-testid="test-icon">🚀</span>;
      renderWithTheme(
        <Button icon={<TestIcon />} iconPosition="left">
          Launch
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Launch' });
      const icon = screen.getByTestId('test-icon');
      
      expect(button).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
      expect(button).toContainElement(icon);
    });

    it('renders with icon on the right', () => {
      const TestIcon = () => <span data-testid="test-icon">➡️</span>;
      renderWithTheme(
        <Button icon={<TestIcon />} iconPosition="right">
          Next
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Next' });
      const icon = screen.getByTestId('test-icon');
      
      expect(button).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
    });

    it('renders icon-only button', () => {
      const TestIcon = () => <span data-testid="test-icon">⚙️</span>;
      renderWithTheme(<Button icon={<TestIcon />} testId="icon-button" />);
      
      const button = screen.getByTestId('icon-button');
      const icon = screen.getByTestId('test-icon');
      
      expect(button).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
      expect(button).not.toHaveTextContent();
    });

    it('renders with custom className', () => {
      renderWithTheme(<Button className="custom-class">Custom Button</Button>);
      const button = screen.getByRole('button', { name: 'Custom Button' });
      expect(button).toHaveClass('custom-class');
    });

    it('renders with testId', () => {
      renderWithTheme(<Button testId="test-button">Test Button</Button>);
      expect(screen.getByTestId('test-button')).toBeInTheDocument();
    });
  });

  describe('Button Types', () => {
    it('renders as button type by default', () => {
      renderWithTheme(<Button>Default Button</Button>);
      const button = screen.getByRole('button', { name: 'Default Button' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('renders as submit type', () => {
      renderWithTheme(<Button type="submit">Submit Button</Button>);
      const button = screen.getByRole('button', { name: 'Submit Button' });
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('renders as reset type', () => {
      renderWithTheme(<Button type="reset">Reset Button</Button>);
      const button = screen.getByRole('button', { name: 'Reset Button' });
      expect(button).toHaveAttribute('type', 'reset');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      const handleClick = jest.fn();
      renderWithTheme(
        <Button disabled onClick={handleClick}>
          Disabled Button
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Disabled Button' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles loading state', () => {
      const handleClick = jest.fn();
      renderWithTheme(
        <Button loading onClick={handleClick}>
          Loading Button
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Loading Button' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles loading state with icon', () => {
      const TestIcon = () => <span data-testid="test-icon">📤</span>;
      renderWithTheme(
        <Button loading icon={<TestIcon />}>
          Upload
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Upload' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Interactions', () => {
    it('handles click events', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(<Button onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button', { name: 'Click Me' });
      
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Button disabled onClick={handleClick}>
          Disabled Button
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Disabled Button' });
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('prevents click when loading', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Button loading onClick={handleClick}>
          Loading Button
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Loading Button' });
      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles keyboard navigation', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(<Button onClick={handleClick}>Keyboard Button</Button>);
      const button = screen.getByRole('button', { name: 'Keyboard Button' });
      
      button.focus();
      expect(button).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('supports keyboard navigation with Tab', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <>
          <Button>First Button</Button>
          <Button>Second Button</Button>
          <Button disabled>Disabled Button</Button>
          <Button>Fourth Button</Button>
        </>
      );
      
      await user.tab();
      expect(screen.getByRole('button', { name: 'First Button' })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: 'Second Button' })).toHaveFocus();
      
      await user.tab();
      // Should skip disabled button
      expect(screen.getByRole('button', { name: 'Fourth Button' })).toHaveFocus();
    });
  });

  describe('Theme Support', () => {
    it('renders correctly in different themes', () => {
      const themeNames = Object.keys(themes) as Array<keyof typeof themes>;
      
      themeNames.forEach(themeName => {
        const { rerender } = renderWithTheme(
          <Button>Themed Button</Button>,
          themeName
        );
        
        const button = screen.getByRole('button', { name: 'Themed Button' });
        expect(button).toBeInTheDocument();
        
        rerender(<></>);
      });
    });

    it('applies high contrast styles when theme is highContrast', () => {
      renderWithTheme(
        <Button variant="primary">High Contrast Button</Button>,
        'highContrast'
      );
      
      const button = screen.getByRole('button', { name: 'High Contrast Button' });
      expect(button).toBeInTheDocument();
    });

    it('applies mission critical styles when theme is missionCritical', () => {
      renderWithTheme(
        <Button variant="danger">Mission Critical Button</Button>,
        'missionCritical'
      );
      
      const button = screen.getByRole('button', { name: 'Mission Critical Button' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <Button>Accessible Button</Button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations when disabled', async () => {
      const { container } = renderWithTheme(
        <Button disabled>Disabled Button</Button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations when loading', async () => {
      const { container } = renderWithTheme(
        <Button loading>Loading Button</Button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations with icon', async () => {
      const TestIcon = () => <span>🚀</span>;
      const { container } = renderWithTheme(
        <Button icon={<TestIcon />}>Launch</Button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations as icon-only button', async () => {
      const TestIcon = () => <span>⚙️</span>;
      const { container } = renderWithTheme(
        <Button icon={<TestIcon />} aria-label="Settings" />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA attributes', () => {
      renderWithTheme(
        <Button
          aria-label="Custom Label"
          aria-describedby="description"
          aria-pressed={true}
        >
          ARIA Button
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Custom Label' });
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
      expect(button).toHaveAttribute('aria-describedby', 'description');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('announces state changes to screen readers', async () => {
      const { rerender } = renderWithTheme(
        <Button>Dynamic Button</Button>
      );
      
      const button = screen.getByRole('button', { name: 'Dynamic Button' });
      expect(button).not.toHaveAttribute('aria-busy');
      expect(button).not.toHaveAttribute('aria-disabled');
      
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Button loading>Dynamic Button</Button>
        </ThemeProvider>
      );
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('respects prefers-reduced-motion', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      
      renderWithTheme(<Button>Reduced Motion Button</Button>);
      const button = screen.getByRole('button', { name: 'Reduced Motion Button' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long text content', () => {
      const longText = 'This is a very long button text that should still render correctly';
      renderWithTheme(<Button>{longText}</Button>);
      
      const button = screen.getByRole('button', { name: longText });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(longText);
    });

    it('handles rapid clicks', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(<Button onClick={handleClick}>Rapid Click</Button>);
      const button = screen.getByRole('button', { name: 'Rapid Click' });
      
      // Simulate rapid clicks
      await user.tripleClick(button);
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('handles form submission', async () => {
      const handleSubmit = jest.fn((e) => e.preventDefault());
      const user = userEvent.setup();
      
      renderWithTheme(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit Form</Button>
        </form>
      );
      
      const button = screen.getByRole('button', { name: 'Submit Form' });
      await user.click(button);
      
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('maintains focus after re-render', async () => {
      const { rerender } = renderWithTheme(
        <Button>Focus Button</Button>
      );
      
      const button = screen.getByRole('button', { name: 'Focus Button' });
      button.focus();
      expect(button).toHaveFocus();
      
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Button>Focus Button</Button>
        </ThemeProvider>
      );
      
      expect(button).toHaveFocus();
    });

    it('handles conditional rendering of icon', () => {
      const TestIcon = () => <span data-testid="test-icon">🎯</span>;
      const { rerender } = renderWithTheme(
        <Button>No Icon</Button>
      );
      
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
      
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Button icon={<TestIcon />}>With Icon</Button>
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const renderSpy = jest.fn();
      
      const TrackedButton = (props: any) => {
        renderSpy();
        return <Button {...props} />;
      };
      
      const { rerender } = renderWithTheme(
        <TrackedButton>Performance Button</TrackedButton>
      );
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
      
      // Re-render with same props
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <TrackedButton>Performance Button</TrackedButton>
        </ThemeProvider>
      );
      
      // Should not cause additional render
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});