import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';
import { action } from '@storybook/addon-actions';
import { within, userEvent, expect } from '@storybook/test';
import React from 'react';
import { SelectOption } from '../types';

// Sample data for stories
const basicOptions: SelectOption[] = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
  { value: 'option4', label: 'Option 4' },
  { value: 'option5', label: 'Option 5' },
];

const countryOptions: SelectOption[] = [
  { value: 'us', label: 'United States', group: 'North America' },
  { value: 'ca', label: 'Canada', group: 'North America' },
  { value: 'mx', label: 'Mexico', group: 'North America' },
  { value: 'uk', label: 'United Kingdom', group: 'Europe' },
  { value: 'fr', label: 'France', group: 'Europe' },
  { value: 'de', label: 'Germany', group: 'Europe' },
  { value: 'it', label: 'Italy', group: 'Europe' },
  { value: 'jp', label: 'Japan', group: 'Asia' },
  { value: 'cn', label: 'China', group: 'Asia' },
  { value: 'in', label: 'India', group: 'Asia' },
];

const statusOptions: SelectOption[] = [
  { value: 'active', label: '🟢 Active' },
  { value: 'pending', label: '🟡 Pending' },
  { value: 'inactive', label: '🔴 Inactive' },
  { value: 'archived', label: '📦 Archived', disabled: true },
];

const roverOptions: SelectOption[] = [
  { value: 'curiosity', label: 'Curiosity', group: 'Mars Rovers' },
  { value: 'perseverance', label: 'Perseverance', group: 'Mars Rovers' },
  { value: 'opportunity', label: 'Opportunity', group: 'Mars Rovers' },
  { value: 'spirit', label: 'Spirit', group: 'Mars Rovers' },
  { value: 'yutu', label: 'Yutu-2', group: 'Lunar Rovers' },
  { value: 'pragyan', label: 'Pragyan', group: 'Lunar Rovers' },
];

const meta: Meta<typeof Select> = {
  title: 'Core Components/Select',
  component: Select,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Select component is a customizable dropdown selection component with support for single/multi-select, search, grouping, and more.

## Features

- **Single and multi-select modes**: Choose one or multiple options
- **Searchable**: Optional search functionality to filter options
- **Grouped options**: Organize options into logical groups
- **Clearable**: Optional clear button to reset selection
- **Validation states**: error, success, warning with appropriate styling
- **Loading state**: Visual feedback during async operations
- **Keyboard navigation**: Full keyboard support for accessibility
- **Full accessibility**: WCAG 2.1 AA compliant with proper ARIA attributes
- **Theme support**: Works with all theme variants

## Usage

\`\`\`tsx
import { Select } from '@/components/ui/core/Select';

// Basic usage
<Select
  options={options}
  value={selectedValue}
  onChange={handleChange}
/>

// Multi-select with search
<Select
  multiple
  searchable
  clearable
  options={options}
  value={selectedValues}
  onChange={handleMultiChange}
/>

// With grouped options
<Select
  options={groupedOptions}
  label="Select Country"
  helperText="Choose your location"
/>

// With validation
<Select
  options={options}
  validationState="error"
  validationMessage="Please select an option"
  required
/>
\`\`\`

## Accessibility

- Full keyboard navigation (Arrow keys, Enter, Escape, Tab)
- Proper ARIA attributes for screen readers
- Focus management and indicators
- Announced state changes
- Label association

## Best Practices

### Do's
- Provide clear, descriptive labels
- Use groups for better organization when having many options
- Enable search for lists with more than 10 items
- Provide validation feedback
- Use appropriate placeholder text

### Don'ts
- Don't use for very small lists (< 3 items) - use radio buttons instead
- Avoid very long option labels
- Don't disable options without clear reason
- Avoid nested dropdowns
- Don't rely on placeholder as the only label
        `,
      },
    },
  },
  argTypes: {
    options: {
      control: false,
      description: 'Array of options to display',
      table: {
        type: { summary: 'SelectOption[]' },
      },
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Size of the select component',
      table: {
        type: { summary: 'ComponentSize' },
        defaultValue: { summary: 'medium' },
      },
    },
    label: {
      control: 'text',
      description: 'Label for the select field',
      table: {
        type: { summary: 'string' },
      },
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no value is selected',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'Select...' },
      },
    },
    helperText: {
      control: 'text',
      description: 'Helper text displayed below the select',
      table: {
        type: { summary: 'string' },
      },
    },
    validationState: {
      control: 'select',
      options: ['default', 'error', 'success', 'warning'],
      description: 'Visual validation state',
      table: {
        type: { summary: 'ValidationState' },
        defaultValue: { summary: 'default' },
      },
    },
    validationMessage: {
      control: 'text',
      description: 'Validation message (overrides helper text)',
      table: {
        type: { summary: 'string' },
      },
    },
    clearable: {
      control: 'boolean',
      description: 'Show clear button when value is selected',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    searchable: {
      control: 'boolean',
      description: 'Enable search functionality',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    multiple: {
      control: 'boolean',
      description: 'Enable multi-select mode',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the select is disabled',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Whether the select is in loading state',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'Whether the select is required',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    maxHeight: {
      control: 'number',
      description: 'Maximum height of the dropdown in pixels',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '300' },
      },
    },
    value: {
      control: false,
      description: 'Selected value(s)',
      table: {
        type: { summary: 'string | number | (string | number)[]' },
      },
    },
    onChange: {
      action: 'changed',
      description: 'Change event handler',
      table: {
        type: { summary: '(value: string | number | (string | number)[]) => void' },
      },
    },
    onClear: {
      action: 'cleared',
      description: 'Clear button click handler',
      table: {
        type: { summary: '() => void' },
      },
    },
  },
  args: {
    options: basicOptions,
    size: 'medium',
    placeholder: 'Select...',
    validationState: 'default',
    clearable: false,
    searchable: false,
    multiple: false,
    disabled: false,
    loading: false,
    required: false,
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

// Basic select
export const Default: Story = {
  args: {
    options: basicOptions,
  },
};

// With label and helper text
export const WithLabel: Story = {
  args: {
    label: 'Choose Option',
    helperText: 'Select one option from the list',
    options: basicOptions,
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Select size="small" label="Small" options={basicOptions} />
      <Select size="medium" label="Medium" options={basicOptions} />
      <Select size="large" label="Large" options={basicOptions} />
    </div>
  ),
};

// Validation states
export const ValidationStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Select
        label="Default"
        validationState="default"
        helperText="Choose your preferred option"
        options={basicOptions}
        value="option1"
      />
      <Select
        label="Success"
        validationState="success"
        validationMessage="Great choice!"
        options={statusOptions}
        value="active"
      />
      <Select
        label="Warning"
        validationState="warning"
        validationMessage="This option has limitations"
        options={basicOptions}
        value="option3"
      />
      <Select
        label="Error"
        validationState="error"
        validationMessage="Please select a valid option"
        options={basicOptions}
        required
      />
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Select label="Normal" options={basicOptions} />
      <Select label="Disabled" options={basicOptions} disabled value="option1" />
      <Select label="Loading" options={basicOptions} loading />
      <Select label="Required" options={basicOptions} required />
    </div>
  ),
};

// Grouped options
export const GroupedOptions: Story = {
  args: {
    label: 'Select Country',
    options: countryOptions,
    helperText: 'Countries are grouped by continent',
  },
};

// Searchable
export const Searchable: Story = {
  args: {
    label: 'Search and Select',
    options: countryOptions,
    searchable: true,
    placeholder: 'Type to search countries...',
  },
};

// Multi-select
export const MultiSelect: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<(string | number)[]>(['us', 'uk']);
    
    return (
      <div style={{ width: '350px' }}>
        <Select
          label="Select Countries"
          options={countryOptions}
          multiple
          searchable
          value={selected}
          onChange={(value) => setSelected(value as (string | number)[])}
          helperText={`${selected.length} countries selected`}
        />
      </div>
    );
  },
};

// Clearable
export const Clearable: Story = {
  render: () => {
    const [single, setSingle] = React.useState<string | number>('option2');
    const [multi, setMulti] = React.useState<(string | number)[]>(['option1', 'option3']);
    
    return (
      <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
        <Select
          label="Single Select (Clearable)"
          options={basicOptions}
          clearable
          value={single}
          onChange={(value) => setSingle(value as string | number)}
          onClear={() => setSingle('')}
        />
        <Select
          label="Multi-Select (Clearable)"
          options={basicOptions}
          multiple
          clearable
          value={multi}
          onChange={(value) => setMulti(value as (string | number)[])}
          onClear={() => setMulti([])}
        />
      </div>
    );
  },
};

// With disabled options
export const WithDisabledOptions: Story = {
  args: {
    label: 'Status',
    options: statusOptions,
    helperText: 'Archived option is disabled',
  },
};

// Interactive example
export const Interactive: Story = {
  args: {
    label: 'Interactive Select',
    options: basicOptions,
    clearable: true,
    searchable: true,
    onChange: action('select-changed'),
    onClear: action('select-cleared'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox');

    // Open dropdown
    await userEvent.click(select);
    await expect(canvas.getByRole('listbox')).toBeInTheDocument();

    // Search for option
    const searchInput = canvas.getByPlaceholderText('Search...');
    await userEvent.type(searchInput, '3');

    // Select option
    await userEvent.click(canvas.getByText('Option 3'));
    await expect(select).toHaveTextContent('Option 3');

    // Clear selection
    const clearButton = canvas.getByLabelText('Clear selection');
    await userEvent.click(clearButton);
    await expect(select).toHaveTextContent('Select...');
  },
};

// Form integration
export const FormExample: Story = {
  render: () => {
    const [formData, setFormData] = React.useState({
      rover: '',
      status: '',
      countries: [] as string[],
    });
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const newErrors: Record<string, string> = {};
      if (!formData.rover) newErrors.rover = 'Please select a rover';
      if (!formData.status) newErrors.status = 'Status is required';
      if (formData.countries.length === 0) newErrors.countries = 'Select at least one country';
      
      setErrors(newErrors);
      
      if (Object.keys(newErrors).length === 0) {
        alert('Form submitted successfully!');
      }
    };
    
    return (
      <form onSubmit={handleSubmit} style={{ width: '400px' }}>
        <div style={{ display: 'grid', gap: '16px' }}>
          <Select
            label="Select Rover"
            options={roverOptions}
            required
            value={formData.rover}
            onChange={(value) => setFormData({ ...formData, rover: value as string })}
            validationState={errors.rover ? 'error' : 'default'}
            validationMessage={errors.rover}
            placeholder="Choose a rover..."
          />
          
          <Select
            label="Mission Status"
            options={statusOptions}
            required
            clearable
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value as string })}
            validationState={errors.status ? 'error' : 'default'}
            validationMessage={errors.status}
          />
          
          <Select
            label="Operating Countries"
            options={countryOptions}
            multiple
            searchable
            clearable
            value={formData.countries}
            onChange={(value) => setFormData({ ...formData, countries: value as string[] })}
            validationState={errors.countries ? 'error' : 'default'}
            validationMessage={errors.countries}
            helperText="Select all applicable countries"
          />
          
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Submit
          </button>
        </div>
      </form>
    );
  },
};

// Accessibility showcase
export const Accessibility: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '24px', width: '350px' }}>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Proper Labeling</h3>
        <Select
          label="Mission Priority"
          options={[
            { value: 'critical', label: 'Critical - Immediate Action' },
            { value: 'high', label: 'High - Within 24 Hours' },
            { value: 'medium', label: 'Medium - Within Week' },
            { value: 'low', label: 'Low - When Possible' },
          ]}
          required
          helperText="Select based on mission impact"
        />
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Keyboard Navigation Demo</h3>
        <p style={{ fontSize: '14px', marginBottom: '8px' }}>
          Tab to focus, Enter/Space to open, Arrow keys to navigate, Escape to close
        </p>
        <Select
          label="Keyboard Accessible"
          options={basicOptions}
          searchable
        />
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Screen Reader Support</h3>
        <Select
          label="Accessible Multi-Select"
          options={statusOptions}
          multiple
          validationState="success"
          validationMessage="2 statuses selected"
          value={['active', 'pending']}
        />
      </div>
    </div>
  ),
};

// Real-world examples
export const RealWorldExamples: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Rover Command Center</h3>
        <div style={{ display: 'grid', gap: '16px', width: '350px' }}>
          <Select
            label="Select Rover"
            options={roverOptions}
            placeholder="Choose rover to control..."
          />
          <Select
            label="Command Type"
            options={[
              { value: 'move', label: '🚗 Movement Commands', group: 'Navigation' },
              { value: 'camera', label: '📷 Camera Operations', group: 'Navigation' },
              { value: 'drill', label: '🔧 Drill Operations', group: 'Science' },
              { value: 'analyze', label: '🔬 Sample Analysis', group: 'Science' },
              { value: 'status', label: '📊 Status Report', group: 'Telemetry' },
              { value: 'diagnostic', label: '🔍 Diagnostics', group: 'Telemetry' },
            ]}
            searchable
          />
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Mission Planning</h3>
        <div style={{ display: 'grid', gap: '16px', width: '350px' }}>
          <Select
            label="Mission Objectives"
            options={[
              { value: 'exploration', label: 'Terrain Exploration' },
              { value: 'sampling', label: 'Rock/Soil Sampling' },
              { value: 'photography', label: 'Panoramic Photography' },
              { value: 'weather', label: 'Weather Monitoring' },
              { value: 'maintenance', label: 'Self Maintenance' },
            ]}
            multiple
            searchable
            clearable
            helperText="Select all objectives for this mission"
          />
          <Select
            label="Mission Duration"
            options={[
              { value: '1h', label: '1 Hour' },
              { value: '4h', label: '4 Hours' },
              { value: '8h', label: '8 Hours (Full Sol)' },
              { value: '24h', label: '24 Hours' },
              { value: 'multi', label: 'Multi-Sol Mission' },
            ]}
            required
          />
        </div>
      </div>
    </div>
  ),
};

// Custom dropdown height
export const CustomDropdownHeight: Story = {
  args: {
    label: 'Limited Height Dropdown',
    options: countryOptions,
    maxHeight: 150,
    searchable: true,
    helperText: 'Dropdown height limited to 150px',
  },
};

// Performance with many options
export const ManyOptions: Story = {
  render: () => {
    const manyOptions: SelectOption[] = Array.from({ length: 100 }, (_, i) => ({
      value: `option${i + 1}`,
      label: `Option ${i + 1}`,
      group: `Group ${Math.floor(i / 10) + 1}`,
    }));
    
    return (
      <div style={{ width: '350px' }}>
        <Select
          label="Large Dataset"
          options={manyOptions}
          searchable
          placeholder="Search from 100 options..."
          helperText="Searchable select with 100 grouped options"
        />
      </div>
    );
  },
};