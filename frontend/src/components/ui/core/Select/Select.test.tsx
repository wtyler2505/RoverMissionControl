import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Select } from './Select';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { themes } from '../../../../theme/themes';
import { SelectOption } from '../types';

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

// Sample options for testing
const basicOptions: SelectOption[] = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
];

const groupedOptions: SelectOption[] = [
  { value: 'us', label: 'United States', group: 'North America' },
  { value: 'ca', label: 'Canada', group: 'North America' },
  { value: 'mx', label: 'Mexico', group: 'North America' },
  { value: 'uk', label: 'United Kingdom', group: 'Europe' },
  { value: 'fr', label: 'France', group: 'Europe' },
  { value: 'de', label: 'Germany', group: 'Europe' },
];

const optionsWithDisabled: SelectOption[] = [
  { value: '1', label: 'Active Option 1' },
  { value: '2', label: 'Disabled Option', disabled: true },
  { value: '3', label: 'Active Option 2' },
];

describe('Select Component', () => {
  describe('Rendering', () => {
    it('renders with placeholder', () => {
      renderWithTheme(<Select options={basicOptions} placeholder="Choose an option" />);
      expect(screen.getByText('Choose an option')).toBeInTheDocument();
    });

    it('renders with label', () => {
      renderWithTheme(<Select options={basicOptions} label="Select Label" />);
      expect(screen.getByText('Select Label')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      renderWithTheme(
        <Select options={basicOptions} helperText="Please select one option" />
      );
      expect(screen.getByText('Please select one option')).toBeInTheDocument();
    });

    it('renders with all sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { rerender } = renderWithTheme(
          <Select options={basicOptions} size={size} testId={`select-${size}`} />
        );
        
        const select = screen.getByTestId(`select-${size}`);
        expect(select).toBeInTheDocument();
        
        rerender(<></>);
      });
    });

    it('renders required field with asterisk', () => {
      renderWithTheme(<Select options={basicOptions} label="Required Field" required />);
      const label = screen.getByText('Required Field');
      expect(label.parentElement).toHaveTextContent('Required Field *');
    });

    it('renders with custom className', () => {
      renderWithTheme(
        <Select options={basicOptions} className="custom-select" testId="custom-select" />
      );
      const wrapper = screen.getByTestId('custom-select');
      expect(wrapper).toHaveClass('custom-select');
    });

    it('renders with testId', () => {
      renderWithTheme(<Select options={basicOptions} testId="test-select" />);
      expect(screen.getByTestId('test-select')).toBeInTheDocument();
    });
  });

  describe('Dropdown Behavior', () => {
    it('opens dropdown on click', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      const select = screen.getByRole('combobox');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      
      await user.click(select);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <div>
          <Select options={basicOptions} />
          <button>Outside</button>
        </div>
      );
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      await user.click(screen.getByText('Outside'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('displays all options in dropdown', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      await user.click(screen.getByRole('combobox'));
      
      basicOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    it('handles grouped options', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={groupedOptions} />);
      
      await user.click(screen.getByRole('combobox'));
      
      // Check group labels
      expect(screen.getByText('North America')).toBeInTheDocument();
      expect(screen.getByText('Europe')).toBeInTheDocument();
      
      // Check options
      groupedOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    it('respects maxHeight prop', async () => {
      const user = userEvent.setup();
      const { container } = renderWithTheme(
        <Select options={basicOptions} maxHeight={100} />
      );
      
      await user.click(screen.getByRole('combobox'));
      const dropdown = container.querySelector('[role="listbox"]');
      expect(dropdown).toHaveStyle('max-height: 100px');
    });
  });

  describe('Selection - Single Mode', () => {
    it('selects option on click', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={basicOptions} onChange={handleChange} />
      );
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      
      await user.click(screen.getByText('Option 2'));
      
      expect(handleChange).toHaveBeenCalledWith('2');
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('displays selected value', () => {
      renderWithTheme(<Select options={basicOptions} value="2" />);
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('handles controlled component', async () => {
      const ControlledSelect = () => {
        const [value, setValue] = React.useState<string | number>('1');
        
        return (
          <Select
            options={basicOptions}
            value={value}
            onChange={(newValue) => setValue(newValue as string)}
          />
        );
      };
      
      const user = userEvent.setup();
      renderWithTheme(<ControlledSelect />);
      
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Option 3'));
      
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });
  });

  describe('Selection - Multiple Mode', () => {
    it('allows multiple selections', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={basicOptions} multiple onChange={handleChange} />
      );
      
      await user.click(screen.getByRole('combobox'));
      
      await user.click(screen.getByText('Option 1'));
      expect(handleChange).toHaveBeenCalledWith(['1']);
      
      await user.click(screen.getByText('Option 2'));
      expect(handleChange).toHaveBeenCalledWith(['1', '2']);
    });

    it('displays count of selected items', () => {
      renderWithTheme(
        <Select options={basicOptions} multiple value={['1', '2']} />
      );
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('deselects items on second click', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={basicOptions} multiple value={['1', '2']} onChange={handleChange} />
      );
      
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Option 1'));
      
      expect(handleChange).toHaveBeenCalledWith(['2']);
    });

    it('shows checkboxes in multiple mode', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Select options={basicOptions} multiple value={['1']} />
      );
      
      await user.click(screen.getByRole('combobox'));
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(basicOptions.length);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('Search Functionality', () => {
    it('shows search input when searchable', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} searchable />);
      
      await user.click(screen.getByRole('combobox'));
      
      const searchInput = screen.getByPlaceholderText('Search...');
      expect(searchInput).toBeInTheDocument();
    });

    it('filters options based on search term', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} searchable />);
      
      await user.click(screen.getByRole('combobox'));
      
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, '2');
      
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    });

    it('shows no results message when no matches', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} searchable />);
      
      await user.click(screen.getByRole('combobox'));
      
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'xyz');
      
      expect(screen.getByText('No options found')).toBeInTheDocument();
    });

    it('resets search on close', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <div>
          <Select options={basicOptions} searchable />
          <button>Outside</button>
        </div>
      );
      
      await user.click(screen.getByRole('combobox'));
      
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, '2');
      
      await user.click(screen.getByText('Outside'));
      await user.click(screen.getByRole('combobox'));
      
      // All options should be visible again
      basicOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });
  });

  describe('Clear Functionality', () => {
    it('shows clear button when clearable and has value', () => {
      renderWithTheme(
        <Select options={basicOptions} clearable value="1" />
      );
      
      expect(screen.getByLabelText('Clear selection')).toBeInTheDocument();
    });

    it('hides clear button when no value', () => {
      renderWithTheme(<Select options={basicOptions} clearable />);
      
      expect(screen.queryByLabelText('Clear selection')).not.toBeInTheDocument();
    });

    it('clears value on clear button click', async () => {
      const handleChange = jest.fn();
      const handleClear = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select
          options={basicOptions}
          clearable
          value="1"
          onChange={handleChange}
          onClear={handleClear}
        />
      );
      
      const clearButton = screen.getByLabelText('Clear selection');
      await user.click(clearButton);
      
      expect(handleChange).toHaveBeenCalledWith(undefined);
      expect(handleClear).toHaveBeenCalled();
    });

    it('clears multiple values', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select
          options={basicOptions}
          multiple
          clearable
          value={['1', '2']}
          onChange={handleChange}
        />
      );
      
      const clearButton = screen.getByLabelText('Clear selection');
      await user.click(clearButton);
      
      expect(handleChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Validation States', () => {
    it('renders with error state', () => {
      renderWithTheme(
        <Select
          options={basicOptions}
          validationState="error"
          validationMessage="Please select an option"
        />
      );
      
      expect(screen.getByText('Please select an option')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
    });

    it('renders with success state', () => {
      renderWithTheme(
        <Select
          options={basicOptions}
          validationState="success"
          validationMessage="Valid selection"
        />
      );
      
      expect(screen.getByText('Valid selection')).toBeInTheDocument();
    });

    it('renders with warning state', () => {
      renderWithTheme(
        <Select
          options={basicOptions}
          validationState="warning"
          validationMessage="Consider another option"
        />
      );
      
      expect(screen.getByText('Consider another option')).toBeInTheDocument();
    });

    it('prioritizes validation message over helper text', () => {
      renderWithTheme(
        <Select
          options={basicOptions}
          helperText="Choose wisely"
          validationState="error"
          validationMessage="Invalid selection"
        />
      );
      
      expect(screen.getByText('Invalid selection')).toBeInTheDocument();
      expect(screen.queryByText('Choose wisely')).not.toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('handles disabled state', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={basicOptions} disabled onChange={handleChange} />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-disabled', 'true');
      
      await user.click(select);
      expect(handleChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('handles loading state', () => {
      renderWithTheme(<Select options={basicOptions} loading />);
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-busy', 'true');
      expect(select).toHaveAttribute('aria-disabled', 'true');
    });

    it('handles disabled options', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={optionsWithDisabled} onChange={handleChange} />
      );
      
      await user.click(screen.getByRole('combobox'));
      
      const disabledOption = screen.getByText('Disabled Option');
      expect(disabledOption.closest('[role="option"]')).toHaveAttribute('aria-disabled', 'true');
      
      await user.click(disabledOption);
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens dropdown with Enter key', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      const select = screen.getByRole('combobox');
      select.focus();
      
      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('opens dropdown with Space key', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      const select = screen.getByRole('combobox');
      select.focus();
      
      await user.keyboard(' ');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('navigates options with arrow keys', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      
      await user.keyboard('{ArrowDown}');
      let highlightedOption = screen.getByRole('option', { selected: true });
      expect(highlightedOption).toHaveTextContent('Option 1');
      
      await user.keyboard('{ArrowDown}');
      highlightedOption = screen.getByRole('option', { selected: true });
      expect(highlightedOption).toHaveTextContent('Option 2');
      
      await user.keyboard('{ArrowUp}');
      highlightedOption = screen.getByRole('option', { selected: true });
      expect(highlightedOption).toHaveTextContent('Option 1');
    });

    it('selects option with Enter key', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={basicOptions} onChange={handleChange} />
      );
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      
      expect(handleChange).toHaveBeenCalledWith('2');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes dropdown with Escape key', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('supports Tab navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <>
          <input placeholder="Before" />
          <Select options={basicOptions} />
          <input placeholder="After" />
        </>
      );
      
      const beforeInput = screen.getByPlaceholderText('Before');
      beforeInput.focus();
      
      await user.tab();
      expect(screen.getByRole('combobox')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByPlaceholderText('After')).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <Select options={basicOptions} label="Accessible Select" />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations when open', async () => {
      const user = userEvent.setup();
      const { container } = renderWithTheme(
        <Select options={basicOptions} label="Accessible Select" />
      );
      
      await user.click(screen.getByRole('combobox'));
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA attributes', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Select
          options={basicOptions}
          label="Test Select"
          validationState="error"
          validationMessage="Required field"
          required
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-expanded', 'false');
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
      expect(select).toHaveAttribute('aria-required', 'true');
      
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');
    });

    it('announces selection to screen readers', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Select options={basicOptions} />);
      
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Option 2'));
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label', expect.stringContaining('Option 2'));
    });

    it('associates label with select', () => {
      renderWithTheme(<Select options={basicOptions} label="Country" />);
      
      const select = screen.getByRole('combobox');
      const label = screen.getByText('Country');
      
      expect(label).toHaveAttribute('for');
      expect(select).toHaveAttribute('id', label.getAttribute('for'));
    });
  });

  describe('Theme Support', () => {
    it('renders correctly in different themes', () => {
      const themeNames = Object.keys(themes) as Array<keyof typeof themes>;
      
      themeNames.forEach(themeName => {
        const { rerender } = renderWithTheme(
          <Select options={basicOptions} />,
          themeName
        );
        
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        
        rerender(<></>);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty options array', () => {
      renderWithTheme(<Select options={[]} />);
      expect(screen.getByText('Select...')).toBeInTheDocument();
    });

    it('handles very long option labels', async () => {
      const longOptions: SelectOption[] = [
        { value: '1', label: 'This is a very long option label that should be truncated properly in the UI' },
      ];
      
      const user = userEvent.setup();
      renderWithTheme(<Select options={longOptions} />);
      
      await user.click(screen.getByRole('combobox'));
      expect(screen.getByText(longOptions[0].label)).toBeInTheDocument();
    });

    it('handles rapid clicks', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Select options={basicOptions} onChange={handleChange} />
      );
      
      const select = screen.getByRole('combobox');
      
      // Rapid clicks
      await user.tripleClick(select);
      
      // Should still be functional
      await user.click(screen.getByText('Option 1'));
      expect(handleChange).toHaveBeenCalledWith('1');
    });

    it('maintains state through re-renders', () => {
      const { rerender } = renderWithTheme(
        <Select options={basicOptions} value="1" />
      );
      
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Select options={basicOptions} value="2" />
        </ThemeProvider>
      );
      
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('handles option value changes', () => {
      const initialOptions: SelectOption[] = [
        { value: '1', label: 'Initial Option' },
      ];
      
      const updatedOptions: SelectOption[] = [
        { value: '1', label: 'Updated Option' },
      ];
      
      const { rerender } = renderWithTheme(
        <Select options={initialOptions} value="1" />
      );
      
      expect(screen.getByText('Initial Option')).toBeInTheDocument();
      
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Select options={updatedOptions} value="1" />
        </ThemeProvider>
      );
      
      expect(screen.getByText('Updated Option')).toBeInTheDocument();
    });
  });
});