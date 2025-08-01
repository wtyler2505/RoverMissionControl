import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { Alert } from '../Alert';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Modal> = {
  title: 'Core Components/Modal',
  component: Modal,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The Modal component provides a dialog overlay for presenting content above the main interface.

## Features
- **Multiple Sizes**: Small, medium, large, and fullscreen options
- **Variants**: Standard, confirmation, and alert modals
- **Focus Management**: Automatic focus trapping and restoration
- **Keyboard Navigation**: ESC to close and proper tab order
- **Portal Rendering**: Renders at document root to avoid z-index issues
- **Accessibility**: Full WCAG 2.1 AA compliance with proper ARIA attributes
- **Theming**: Supports all four application themes

## Mission Control Usage
Perfect for command confirmations, system settings, data visualization overlays, and critical alerts in rover mission control interfaces.
        `,
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the modal is visible',
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large', 'fullscreen'],
      description: 'Size of the modal',
    },
    variant: {
      control: { type: 'select' },
      options: ['standard', 'confirmation', 'alert'],
      description: 'Visual and behavioral variant',
    },
    title: {
      control: 'text',
      description: 'Modal title',
    },
    closeOnBackdropClick: {
      control: 'boolean',
      description: 'Whether clicking backdrop closes modal',
    },
    closeOnEsc: {
      control: 'boolean',
      description: 'Whether ESC key closes modal',
    },
    showCloseButton: {
      control: 'boolean',
      description: 'Whether to show close button in header',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when modal is closed',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Modal>;

// Basic sizes
export const Small: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Small Modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="small"
          title="Small Modal"
        >
          <p>This is a small modal perfect for simple confirmations and brief messages.</p>
          <p>It maintains optimal readability while conserving screen space.</p>
        </Modal>
      </>
    );
  },
};

export const Medium: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Medium Modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="medium"
          title="Medium Modal"
        >
          <p>This is a medium-sized modal suitable for most use cases.</p>
          <p>It provides a good balance between content space and user focus.</p>
          <p>Perfect for forms, detailed information, and complex interactions.</p>
        </Modal>
      </>
    );
  },
};

export const Large: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Large Modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="large"
          title="Large Modal"
        >
          <p>This is a large modal ideal for complex content and detailed interfaces.</p>
          <p>Use for data tables, multi-step forms, or comprehensive settings panels.</p>
          <div style={{ height: '400px', background: '#f5f5f5', borderRadius: '4px', padding: '20px', marginTop: '16px' }}>
            <p>Large content area with scrollable overflow when needed.</p>
            <p>Maintains proper focus management even with extensive content.</p>
          </div>
        </Modal>
      </>
    );
  },
};

export const Fullscreen: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Fullscreen Modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="fullscreen"
          title="Fullscreen Modal"
        >
          <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>Fullscreen modal takes up the entire viewport for immersive experiences.</p>
            <p>Perfect for detailed data analysis, comprehensive dashboards, or complex workflows.</p>
            <div style={{ 
              flex: 1, 
              background: '#f5f5f5', 
              borderRadius: '4px', 
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <h3>Fullscreen Content Area</h3>
                <p>Use this space for complex interfaces, data visualization, or detailed forms.</p>
              </div>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

// Confirmation modals
export const ConfirmationModal: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const handleConfirm = async () => {
      setLoading(true);
      action('confirm-action')();
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      setLoading(false);
      setOpen(false);
    };
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Show Confirmation</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          variant="confirmation"
          title="Confirm Action"
          confirmText="Execute Command"
          cancelText="Cancel"
          onConfirm={handleConfirm}
          onCancel={() => action('cancel-action')()}
          loading={loading}
        >
          <p>Are you sure you want to execute this rover navigation command?</p>
          <p>This action will move the rover to coordinates (47.2, -15.8) and cannot be undone.</p>
        </Modal>
      </>
    );
  },
};

export const DangerousConfirmation: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Emergency Stop
        </Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          variant="confirmation"
          title="Emergency Stop Confirmation"
          confirmText="Emergency Stop"
          cancelText="Cancel"
          onConfirm={() => action('emergency-stop')()}
          onCancel={() => action('cancel-emergency')()}
          danger={true}
        >
          <Alert variant="warning" title="Critical Action">
            This will immediately halt all rover operations and may cause mission delays.
          </Alert>
          <p style={{ marginTop: '16px' }}>
            Are you sure you want to trigger an emergency stop? This action should only be used in critical situations.
          </p>
        </Modal>
      </>
    );
  },
};

// With custom footer
export const WithCustomFooter: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open with Custom Footer</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Mission Settings"
          footer={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button variant="tertiary" size="small" onClick={() => action('save-draft')()}>
                Save Draft
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => action('apply-settings')()}>
                Apply Settings
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Mission Name" placeholder="Enter mission name" />
            <Input label="Duration (hours)" type="number" placeholder="24" />
            <Input label="Primary Objective" placeholder="Sample collection" />
          </div>
        </Modal>
      </>
    );
  },
};

// Mission Control Scenarios
export const MissionControlScenarios: Story = {
  render: () => {
    const [openModals, setOpenModals] = useState({
      telemetry: false,
      command: false,
      alert: false,
      settings: false,
    });
    
    const openModal = (key: keyof typeof openModals) => {
      setOpenModals(prev => ({ ...prev, [key]: true }));
    };
    
    const closeModal = (key: keyof typeof openModals) => {
      setOpenModals(prev => ({ ...prev, [key]: false }));
    };
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3>Mission Control Modal Examples</h3>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Button onClick={() => openModal('telemetry')} variant="primary">
            View Telemetry Data
          </Button>
          <Button onClick={() => openModal('command')} variant="secondary">
            Send Command
          </Button>
          <Button onClick={() => openModal('alert')} variant="danger">
            System Alert
          </Button>
          <Button onClick={() => openModal('settings')} variant="tertiary">
            Mission Settings
          </Button>
        </div>
        
        {/* Telemetry Data Modal */}
        <Modal
          open={openModals.telemetry}
          onClose={() => closeModal('telemetry')}
          size="large"
          title="Real-Time Telemetry Dashboard"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Position</h4>
              <p style={{ margin: 0, fontFamily: 'monospace' }}>
                Lat: 47.2451°<br />
                Lon: -15.8923°<br />
                Alt: 2,847m
              </p>
            </div>
            <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Power Systems</h4>
              <p style={{ margin: 0, fontFamily: 'monospace' }}>
                Battery: 87%<br />
                Solar: 124W<br />
                Consumption: 89W
              </p>
            </div>
            <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Environmental</h4>
              <p style={{ margin: 0, fontFamily: 'monospace' }}>
                Temp: -23°C<br />
                Wind: 12 km/h<br />
                Pressure: 0.87 kPa
              </p>
            </div>
          </div>
          <div style={{ marginTop: '24px', height: '200px', background: '#e9ecef', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#666' }}>Live telemetry chart would appear here</span>
          </div>
        </Modal>
        
        {/* Command Modal */}
        <Modal
          open={openModals.command}
          onClose={() => closeModal('command')}
          size="medium"
          title="Send Rover Command"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => closeModal('command')}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => action('send-command')()}>
                Send Command
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Alert variant="info" title="Command Queue Status">
              2 commands pending execution. Estimated completion: 14 minutes.
            </Alert>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input 
                label="Command Type" 
                placeholder="Select command..." 
                value="NAVIGATE_TO_WAYPOINT"
                readOnly
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input label="Latitude" placeholder="47.2451" />
                <Input label="Longitude" placeholder="-15.8923" />
              </div>
              <Input label="Max Speed (m/s)" type="number" placeholder="0.5" />
              <Input label="Priority" placeholder="NORMAL" value="HIGH" />
            </div>
          </div>
        </Modal>
        
        {/* Alert Modal */}
        <Modal
          open={openModals.alert}
          onClose={() => closeModal('alert')}
          variant="confirmation"
          title="Critical System Alert"
          confirmText="Acknowledge & Continue"
          cancelText="View Details"
          onConfirm={() => action('acknowledge-alert')()}
          onCancel={() => action('view-alert-details')()}
          danger={true}
        >
          <Alert variant="error" title="Hardware Malfunction" icon={false}>
            Drill subsystem has exceeded temperature threshold (95°C). 
            Operations have been automatically suspended.
          </Alert>
          <div style={{ marginTop: '16px' }}>
            <p><strong>Affected Systems:</strong></p>
            <ul>
              <li>Sample collection drill</li>
              <li>Thermal management</li>
              <li>Power distribution to drilling systems</li>
            </ul>
            <p><strong>Recommended Actions:</strong></p>
            <ul>
              <li>Allow 30-minute cooling period</li>
              <li>Run thermal diagnostics</li>
              <li>Check dust accumulation on heat sinks</li>
            </ul>
          </div>
        </Modal>
        
        {/* Settings Modal */}
        <Modal
          open={openModals.settings}
          onClose={() => closeModal('settings')}
          size="medium"
          title="Mission Configuration"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ margin: '0 0 12px 0' }}>Communication Settings</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Input label="Telemetry Interval (seconds)" type="number" value="5" />
                <Input label="Command Timeout (seconds)" type="number" value="30" />
                <Input label="Heartbeat Interval (seconds)" type="number" value="10" />
              </div>
            </div>
            
            <div>
              <h4 style={{ margin: '0 0 12px 0' }}>Safety Parameters</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Input label="Max Operating Temperature (°C)" type="number" value="85" />
                <Input label="Min Battery Level (%)" type="number" value="15" />
                <Input label="Emergency Stop Radius (m)" type="number" value="2" />
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
};

// Accessibility features
export const AccessibilityFeatures: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [openSecond, setOpenSecond] = useState(false);
    
    return (
      <>
        <div style={{ marginBottom: '16px' }}>
          <h3>Accessibility Features Demonstration</h3>
          <p>This modal demonstrates various accessibility features:</p>
          <ul>
            <li><strong>Focus Management:</strong> Focus is trapped within the modal</li>
            <li><strong>Keyboard Navigation:</strong> Tab cycles through focusable elements</li>
            <li><strong>ESC Key:</strong> Closes the modal</li>
            <li><strong>ARIA Attributes:</strong> Proper labeling for screen readers</li>
            <li><strong>Focus Restoration:</strong> Returns focus to trigger element when closed</li>
          </ul>
        </div>
        
        <Button onClick={() => setOpen(true)}>
          Open Accessible Modal
        </Button>
        
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Accessibility Features"
          size="medium"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setOpenSecond(true)}>
                Open Second Modal
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>Try these accessibility features:</p>
            <ul>
              <li>Press <kbd>Tab</kbd> to navigate between focusable elements</li>
              <li>Press <kbd>Shift + Tab</kbd> to navigate backwards</li>
              <li>Press <kbd>Escape</kbd> to close the modal</li>
              <li>Use a screen reader to hear proper announcements</li>
            </ul>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input label="Test Input 1" placeholder="Focus order test" />
              <Input label="Test Input 2" placeholder="Tab navigation test" />
              <Button variant="secondary" onClick={() => action('accessible-action')()}>
                Focusable Button
              </Button>
            </div>
          </div>
        </Modal>
        
        {/* Second modal to test focus management */}
        <Modal
          open={openSecond}
          onClose={() => setOpenSecond(false)}
          title="Second Modal"
          size="small"
        >
          <p>This second modal demonstrates that focus management works correctly even with nested modals.</p>
          <p>When you close this modal, focus will return to the first modal.</p>
        </Modal>
      </>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the comprehensive accessibility features of the Modal component:

### Focus Management
- **Focus Trap**: Focus is contained within the modal
- **Initial Focus**: First focusable element receives focus when modal opens
- **Focus Restoration**: Focus returns to the triggering element when modal closes

### Keyboard Navigation
- **Tab Navigation**: Tab key cycles through focusable elements
- **Escape Key**: ESC key closes the modal (can be disabled)
- **Proper Tab Order**: Focus follows logical sequence

### Screen Reader Support
- **ARIA Attributes**: Proper \`role="dialog"\` and \`aria-modal="true"\`
- **Accessible Names**: Modal is labeled by its title
- **Status Announcements**: Screen readers announce modal state changes

### Visual Accessibility
- **High Contrast**: Colors adjust for high contrast preferences
- **Reduced Motion**: Animations respect prefers-reduced-motion
- **Focus Indicators**: Clear visual focus indicators on all interactive elements
        `,
      },
    },
  },
};