import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';
import { Button } from '../Button';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Checkbox> = {
  title: 'Core Components/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The Checkbox component allows users to select or deselect options, supporting binary choice or multi-selection scenarios.

## Features
- **Multiple Sizes**: Small, medium, and large options
- **Indeterminate State**: Support for partially selected states
- **Validation States**: Error, success, warning, and default states
- **Controlled/Uncontrolled**: Supports both controlled and uncontrolled usage
- **Accessibility**: Full WCAG 2.1 AA compliance with proper ARIA attributes
- **Keyboard Navigation**: Space key toggles, proper focus management
- **Theming**: Supports all four application themes

## Mission Control Usage
Perfect for system configuration options, multi-selection lists, feature toggles, and consent forms in rover mission control interfaces.
        `,
      },
    },
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Size of the checkbox',
    },
    label: {
      control: 'text',
      description: 'Checkbox label text',
    },
    checked: {
      control: 'boolean',
      description: 'Controlled checked state',
    },
    defaultChecked: {
      control: 'boolean',
      description: 'Default checked state for uncontrolled usage',
    },
    indeterminate: {
      control: 'boolean',
      description: 'Whether checkbox is in indeterminate state',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether checkbox is disabled',
    },
    validationState: {
      control: { type: 'select' },
      options: ['default', 'error', 'success', 'warning'],
      description: 'Validation state of the checkbox',
    },
    validationMessage: {
      control: 'text',
      description: 'Validation message to display',
    },
    onChange: {
      action: 'changed',
      description: 'Change event handler',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

// Basic checkbox
export const Basic: Story = {
  args: {
    label: 'Accept terms and conditions',
  },
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Checkbox size="small" label="Small checkbox" defaultChecked />
      <Checkbox size="medium" label="Medium checkbox (default)" defaultChecked />
      <Checkbox size="large" label="Large checkbox" defaultChecked />
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Checkbox label="Unchecked checkbox" />
      <Checkbox label="Checked checkbox" defaultChecked />
      <Checkbox label="Indeterminate checkbox" indeterminate />
      <Checkbox label="Disabled unchecked" disabled />
      <Checkbox label="Disabled checked" disabled defaultChecked />
      <Checkbox label="Disabled indeterminate" disabled indeterminate />
    </div>
  ),
};

// Validation states
export const Validation: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Checkbox
        label="Default validation state"
        validationState="default"
        validationMessage="This is a default validation message"
      />
      <Checkbox
        label="Error validation state"
        validationState="error"
        validationMessage="This field is required"
        defaultChecked
      />
      <Checkbox
        label="Success validation state"
        validationState="success"
        validationMessage="Configuration saved successfully"
        defaultChecked
      />
      <Checkbox
        label="Warning validation state"
        validationState="warning"
        validationMessage="This setting may affect system performance"
        defaultChecked
      />
    </div>
  ),
};

// Controlled checkbox
export const Controlled: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    const [indeterminate, setIndeterminate] = useState(false);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Checkbox
          label="Controlled checkbox"
          checked={checked}
          indeterminate={indeterminate}
          onChange={(e) => {
            setChecked(e.target.checked);
            setIndeterminate(false);
            action('checkbox-change')(e.target.checked);
          }}
        />
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            size="small" 
            variant="tertiary"
            onClick={() => {
              setChecked(true);
              setIndeterminate(false);
            }}
          >
            Check
          </Button>
          <Button 
            size="small" 
            variant="tertiary"
            onClick={() => {
              setChecked(false);
              setIndeterminate(false);
            }}
          >
            Uncheck
          </Button>
          <Button 
            size="small" 
            variant="tertiary"
            onClick={() => {
              setChecked(false);
              setIndeterminate(true);
            }}
          >
            Indeterminate
          </Button>
        </div>
      </div>
    );
  },
};

// Group selection with parent checkbox
export const GroupSelection: Story = {
  render: () => {
    const [items, setItems] = useState([
      { id: 'telemetry', label: 'Telemetry Systems', checked: true },
      { id: 'navigation', label: 'Navigation Systems', checked: false },
      { id: 'power', label: 'Power Management', checked: true },
      { id: 'communication', label: 'Communication Array', checked: false },
    ]);

    const checkedItems = items.filter(item => item.checked);
    const allChecked = checkedItems.length === items.length;
    const someChecked = checkedItems.length > 0 && checkedItems.length < items.length;

    const toggleAll = (checked: boolean) => {
      setItems(items.map(item => ({ ...item, checked })));
      action('toggle-all')(checked);
    };

    const toggleItem = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setItems(items.map(item => 
        item.id === id ? { ...item, checked: e.target.checked } : item
      ));
      action('toggle-item')(id, e.target.checked);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ 
          padding: '16px', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <Checkbox
            label="System Monitoring Configuration"
            checked={allChecked}
            indeterminate={someChecked}
            onChange={(e) => toggleAll(e.target.checked)}
            style={{ fontWeight: 'bold' }}
          />
          
          <div style={{ 
            marginTop: '12px', 
            paddingLeft: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}>
            {items.map(item => (
              <Checkbox
                key={item.id}
                label={item.label}
                checked={item.checked}
                onChange={toggleItem(item.id)}
              />
            ))}
          </div>
          
          <div style={{ 
            marginTop: '16px', 
            padding: '8px', 
            background: 'white', 
            borderRadius: '4px',
            fontSize: '14px',
            color: '#666'
          }}>
            {checkedItems.length} of {items.length} systems selected for monitoring
          </div>
        </div>
      </div>
    );
  },
};

// Mission Control Configuration
export const MissionControlScenarios: Story = {
  render: () => {
    const [systemConfig, setSystemConfig] = useState({
      // Safety systems
      emergencyStop: true,
      autonomousNavigation: false,
      obstacleAvoidance: true,
      temperatureMonitoring: true,
      
      // Communication settings
      continuousTelemetry: true,
      dataLogging: true,
      alertNotifications: false,
      
      // Operational settings
      powerOptimization: true,
      sampleAnalysis: false,
      imageCapture: true,
      statusReporting: true,
    });

    const handleConfigChange = (key: keyof typeof systemConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setSystemConfig(prev => ({ ...prev, [key]: e.target.checked }));
      action('config-change')(key, e.target.checked);
    };

    const criticalSystems = ['emergencyStop', 'obstacleAvoidance', 'temperatureMonitoring'];
    const hasCriticalUnchecked = criticalSystems.some(key => !systemConfig[key as keyof typeof systemConfig]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ margin: 0 }}>Rover Mission Control Configuration</h3>
        
        {hasCriticalUnchecked && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#fef3c7', 
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            color: '#92400e'
          }}>
            ⚠️ Warning: Critical safety systems are disabled. Mission safety may be compromised.
          </div>
        )}

        {/* Safety Systems */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          background: 'white'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#dc2626' }}>Safety Systems</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Checkbox
              label="Emergency Stop Protocol"
              checked={systemConfig.emergencyStop}
              onChange={handleConfigChange('emergencyStop')}
              validationState={!systemConfig.emergencyStop ? 'error' : 'default'}
              validationMessage={!systemConfig.emergencyStop ? 'Emergency stop is critical for mission safety' : undefined}
            />
            <Checkbox
              label="Autonomous Navigation"
              checked={systemConfig.autonomousNavigation}
              onChange={handleConfigChange('autonomousNavigation')}
            />
            <Checkbox
              label="Obstacle Avoidance"
              checked={systemConfig.obstacleAvoidance}
              onChange={handleConfigChange('obstacleAvoidance')}
              validationState={!systemConfig.obstacleAvoidance ? 'warning' : 'default'}
              validationMessage={!systemConfig.obstacleAvoidance ? 'Recommended for terrain navigation' : undefined}
            />
            <Checkbox
              label="Temperature Monitoring"
              checked={systemConfig.temperatureMonitoring}
              onChange={handleConfigChange('temperatureMonitoring')}
              validationState={!systemConfig.temperatureMonitoring ? 'error' : 'default'}
              validationMessage={!systemConfig.temperatureMonitoring ? 'Required for equipment protection' : undefined}
            />
          </div>
        </div>

        {/* Communication Settings */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          background: 'white'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#2563eb' }}>Communication Settings</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Checkbox
              label="Continuous Telemetry Stream"
              checked={systemConfig.continuousTelemetry}
              onChange={handleConfigChange('continuousTelemetry')}
              validationState={systemConfig.continuousTelemetry ? 'success' : 'default'}
              validationMessage={systemConfig.continuousTelemetry ? 'Real-time monitoring enabled' : undefined}
            />
            <Checkbox
              label="Data Logging"
              checked={systemConfig.dataLogging}
              onChange={handleConfigChange('dataLogging')}
            />
            <Checkbox
              label="Alert Notifications"
              checked={systemConfig.alertNotifications}
              onChange={handleConfigChange('alertNotifications')}
            />
          </div>
        </div>

        {/* Operational Settings */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          background: 'white'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#059669' }}>Operational Settings</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Checkbox
              label="Power Optimization"
              checked={systemConfig.powerOptimization}
              onChange={handleConfigChange('powerOptimization')}
              validationState={systemConfig.powerOptimization ? 'success' : 'warning'}
              validationMessage={systemConfig.powerOptimization ? 'Extended mission duration enabled' : 'May reduce operational time'}
            />
            <Checkbox
              label="Automatic Sample Analysis"
              checked={systemConfig.sampleAnalysis}
              onChange={handleConfigChange('sampleAnalysis')}
            />
            <Checkbox
              label="Image Capture"
              checked={systemConfig.imageCapture}
              onChange={handleConfigChange('imageCapture')}
            />
            <Checkbox
              label="Status Reporting"
              checked={systemConfig.statusReporting}
              onChange={handleConfigChange('statusReporting')}
            />
          </div>
        </div>

        {/* Configuration Summary */}
        <div style={{ 
          padding: '16px', 
          background: '#f3f4f6', 
          borderRadius: '8px',
          border: '1px solid #d1d5db'
        }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Configuration Summary</h4>
          <div style={{ fontSize: '14px', color: '#374151' }}>
            <div>Total options configured: {Object.values(systemConfig).filter(Boolean).length} of {Object.keys(systemConfig).length}</div>
            <div>Critical systems status: {criticalSystems.filter(key => systemConfig[key as keyof typeof systemConfig]).length} of {criticalSystems.length} enabled</div>
          </div>
        </div>
      </div>
    );
  },
};

// Form integration
export const FormIntegration: Story = {
  render: () => {
    const [formData, setFormData] = useState({
      acceptTerms: false,
      receiveNotifications: true,
      dataSharing: false,
      marketing: false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const newErrors: Record<string, string> = {};
      
      if (!formData.acceptTerms) {
        newErrors.acceptTerms = 'You must accept the terms and conditions to proceed';
      }

      setErrors(newErrors);
      
      if (Object.keys(newErrors).length === 0) {
        action('form-submit')(formData);
        alert('Form submitted successfully!');
      }
    };

    const handleChange = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, [key]: e.target.checked }));
      
      // Clear error when user interacts
      if (errors[key]) {
        setErrors(prev => ({ ...prev, [key]: '' }));
      }
      
      action('form-change')(key, e.target.checked);
    };

    return (
      <form onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0 }}>Mission Control Access Agreement</h3>
          
          <Checkbox
            label="I accept the terms and conditions for rover mission control access"
            checked={formData.acceptTerms}
            onChange={handleChange('acceptTerms')}
            validationState={errors.acceptTerms ? 'error' : 'default'}
            validationMessage={errors.acceptTerms}
            required
          />
          
          <Checkbox
            label="Send me system notifications and alerts"
            checked={formData.receiveNotifications}
            onChange={handleChange('receiveNotifications')}
            validationState="success"
            validationMessage="Recommended for mission-critical updates"
          />
          
          <Checkbox
            label="Share telemetry data with research partners"
            checked={formData.dataSharing}
            onChange={handleChange('dataSharing')}
          />
          
          <Checkbox
            label="Receive marketing communications about new missions"
            checked={formData.marketing}
            onChange={handleChange('marketing')}
          />
          
          <div style={{ 
            paddingTop: '16px', 
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '12px'
          }}>
            <Button type="submit" variant="primary">
              Submit Application
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                setFormData({
                  acceptTerms: false,
                  receiveNotifications: true,
                  dataSharing: false,
                  marketing: false,
                });
                setErrors({});
                action('form-reset')();
              }}
            >
              Reset Form
            </Button>
          </div>
        </div>
      </form>
    );
  },
};

// Accessibility features
export const AccessibilityFeatures: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h3>Accessibility Features Demonstration</h3>
      
      <div style={{ 
        padding: '16px', 
        background: '#f0f9ff', 
        border: '1px solid #0284c7',
        borderRadius: '8px' 
      }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Accessibility Features:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>Keyboard Navigation:</strong> Space key toggles checkbox state</li>
          <li><strong>Focus Indicators:</strong> Clear visual focus rings for keyboard users</li>
          <li><strong>ARIA Attributes:</strong> Proper invalid state and describedby associations</li>
          <li><strong>Label Association:</strong> Clicking label toggles checkbox</li>
          <li><strong>Screen Reader:</strong> All states announced appropriately</li>
          <li><strong>High Contrast:</strong> Enhanced borders and indicators in high contrast mode</li>
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Checkbox
          label="Keyboard accessible checkbox (try Tab + Space)"
          defaultChecked
        />
        
        <Checkbox
          label="Checkbox with validation error"
          validationState="error"
          validationMessage="This field has an error and is announced to screen readers"
        />
        
        <Checkbox
          label="Indeterminate checkbox with mixed selection"
          indeterminate
        />
        
        <Checkbox
          label="Large checkbox for better visibility"
          size="large"
          defaultChecked
        />
        
        <div style={{ opacity: 0.6 }}>
          <Checkbox
            label="Disabled checkbox (not focusable)"
            disabled
            defaultChecked
          />
        </div>
      </div>

      <div style={{ 
        padding: '16px', 
        background: '#fefce8', 
        border: '1px solid #eab308',
        borderRadius: '8px' 
      }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Try these keyboard interactions:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
          <li><kbd>Tab</kbd>: Navigate to the next checkbox</li>
          <li><kbd>Shift + Tab</kbd>: Navigate to the previous checkbox</li>
          <li><kbd>Space</kbd>: Toggle the focused checkbox</li>
          <li><kbd>Enter</kbd>: Also toggles the focused checkbox</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the comprehensive accessibility features of the Checkbox component:

### Keyboard Navigation
- **Tab Navigation**: Checkboxes are included in the natural tab order
- **Space/Enter Keys**: Both keys toggle the checkbox state
- **Focus Management**: Clear visual focus indicators

### ARIA Support
- **aria-invalid**: Set to true when validation state is "error"
- **aria-describedby**: Associates validation messages with the checkbox
- **Label Association**: Proper label-input relationships

### Screen Reader Support
- **State Announcements**: Checked, unchecked, and indeterminate states are announced
- **Validation Messages**: Error messages are announced when present
- **Label Reading**: Screen readers read the associated label text

### Visual Accessibility
- **High Contrast**: Enhanced borders and visual indicators
- **Focus Indicators**: Clear, visible focus rings
- **Color Independence**: State is not conveyed by color alone

### Form Integration
- **Validation**: Proper error state communication
- **Required Fields**: Support for required field validation
- **Form Submission**: Standard form behavior and validation
        `,
      },
    },
  },
};