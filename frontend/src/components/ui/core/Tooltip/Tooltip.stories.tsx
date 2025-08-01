import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { Button } from '../Button';
import { Input } from '../Input';
import { Badge } from '../Badge';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Tooltip> = {
  title: 'Core Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The Tooltip component provides contextual information when users hover, focus, or click on an element.

## Features
- **Multiple Positions**: 8 positioning options (top, right, bottom, left + start/end variants)
- **Multiple Triggers**: Hover, focus, click, and manual control
- **Flexible Content**: Text, HTML, or React components
- **Delay Support**: Configurable show/hide delays
- **Accessibility**: Full WCAG 2.1 AA compliance with proper ARIA attributes
- **Portal Rendering**: Renders at document root to avoid z-index issues
- **Theming**: Supports all four application themes

## Mission Control Usage
Perfect for providing contextual help, showing detailed telemetry information, explaining system status indicators, and displaying additional data in rover mission control interfaces.
        `,
      },
    },
  },
  argTypes: {
    position: {
      control: { type: 'select' },
      options: ['top', 'top-start', 'top-end', 'right', 'bottom', 'bottom-start', 'bottom-end', 'left'],
      description: 'Position of the tooltip relative to trigger element',
    },
    trigger: {
      control: { type: 'select' },
      options: ['hover', 'focus', 'click'],
      description: 'How the tooltip is triggered',
    },
    content: {
      control: 'text',
      description: 'Tooltip content',
    },
    delay: {
      control: { type: 'number', min: 0, max: 2000, step: 100 },
      description: 'Delay before showing tooltip (ms)',
    },
    offset: {
      control: { type: 'number', min: 0, max: 50, step: 2 },
      description: 'Distance between tooltip and trigger element',
    },
    arrow: {
      control: 'boolean',
      description: 'Whether to show the tooltip arrow',
    },
    maxWidth: {
      control: { type: 'number', min: 100, max: 500, step: 50 },
      description: 'Maximum width of tooltip content',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

// Basic tooltip
export const Basic: Story = {
  args: {
    content: 'This is a basic tooltip with helpful information',
    children: <Button>Hover me</Button>,
  },
};

// All positions
export const Positions: Story = {
  render: () => (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
      gap: '60px',
      padding: '80px',
      placeItems: 'center'
    }}>
      {/* Top row */}
      <Tooltip content="Top start position" position="top-start">
        <Button size="small">Top Start</Button>
      </Tooltip>
      
      <Tooltip content="Top center position" position="top">
        <Button size="small">Top</Button>
      </Tooltip>
      
      <Tooltip content="Top end position" position="top-end">
        <Button size="small">Top End</Button>
      </Tooltip>
      
      {/* Middle row */}
      <Tooltip content="Left position with longer content" position="left">
        <Button size="small">Left</Button>
      </Tooltip>
      
      <div style={{ 
        padding: '20px', 
        border: '2px dashed #ccc', 
        borderRadius: '8px',
        textAlign: 'center',
        color: '#666'
      }}>
        <span>Center Reference</span>
      </div>
      
      <Tooltip content="Right position tooltip" position="right">
        <Button size="small">Right</Button>
      </Tooltip>
      
      {/* Bottom row */}
      <Tooltip content="Bottom start position" position="bottom-start">
        <Button size="small">Bottom Start</Button>
      </Tooltip>
      
      <Tooltip content="Bottom center position" position="bottom">
        <Button size="small">Bottom</Button>
      </Tooltip>
      
      <Tooltip content="Bottom end position" position="bottom-end">
        <Button size="small">Bottom End</Button>
      </Tooltip>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Different triggers
export const Triggers: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
      <Tooltip content="This tooltip appears on hover" trigger="hover">
        <Button variant="primary">Hover Trigger</Button>
      </Tooltip>
      
      <Tooltip content="This tooltip appears when focused (try Tab key)" trigger="focus">
        <Button variant="secondary">Focus Trigger</Button>
      </Tooltip>
      
      <Tooltip content="This tooltip appears when clicked (click again to hide)" trigger="click">
        <Button variant="tertiary">Click Trigger</Button>
      </Tooltip>
    </div>
  ),
};

// With delay
export const WithDelay: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Tooltip content="Appears immediately" delay={0}>
        <Button>No Delay</Button>
      </Tooltip>
      
      <Tooltip content="Appears after 500ms" delay={500}>
        <Button>500ms Delay</Button>
      </Tooltip>
      
      <Tooltip content="Appears after 1000ms" delay={1000}>
        <Button>1000ms Delay</Button>
      </Tooltip>
    </div>
  ),
};

// Without arrow
export const WithoutArrow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Tooltip content="Tooltip with arrow (default)" arrow={true}>
        <Button>With Arrow</Button>
      </Tooltip>
      
      <Tooltip content="Clean tooltip without arrow" arrow={false}>
        <Button>Without Arrow</Button>
      </Tooltip>
    </div>
  ),
};

// Long content with max width
export const LongContent: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Tooltip 
        content="This is a very long tooltip content that would normally extend beyond reasonable width limits, but with maxWidth it wraps nicely"
        maxWidth={200}
      >
        <Button>Long Content (200px max)</Button>
      </Tooltip>
      
      <Tooltip 
        content="This tooltip has even more extensive content that includes detailed explanations, multiple sentences, and comprehensive information that users might need to understand complex system operations"
        maxWidth={300}
      >
        <Button>Very Long Content (300px max)</Button>
      </Tooltip>
    </div>
  ),
};

// Controlled tooltip
export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    
    return (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <Tooltip 
          content="This tooltip is controlled externally"
          open={open}
          onOpenChange={(newOpen) => {
            setOpen(newOpen);
            action('tooltip-state-change')(newOpen);
          }}
        >
          <Button>Controlled Tooltip</Button>
        </Tooltip>
        
        <Button 
          variant="tertiary" 
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide' : 'Show'} Tooltip
        </Button>
      </div>
    );
  },
};

// Mission Control Scenarios
export const MissionControlScenarios: Story = {
  render: () => {
    const systemMetrics = {
      battery: { value: 87, status: 'good' },
      temperature: { value: -23, status: 'normal' },
      signal: { value: 85, status: 'strong' },
      speed: { value: 0.3, status: 'nominal' }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ margin: 0 }}>Mission Control Interface Examples</h3>
        
        {/* System Status Dashboard */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '16px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Tooltip 
              content={
                <div>
                  <strong>Battery Status</strong><br />
                  Current: 87%<br />
                  Estimated runtime: 14.2 hours<br />
                  Last charged: 2 days ago<br />
                  Health: Excellent (98%)
                </div>
              }
              maxWidth={250}
              position="top"
            >
              <div style={{ cursor: 'help' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>87%</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Battery</div>
                <Badge variant="success" style={{ marginTop: '4px' }}>Good</Badge>
              </div>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip 
              content={
                <div>
                  <strong>Environmental Temperature</strong><br />
                  Current: -23°C<br />
                  Range today: -31°C to -18°C<br />
                  Operating limit: -40°C to +85°C<br />
                  Thermal management: Active
                </div>
              }
              maxWidth={250}
              position="top"
            >
              <div style={{ cursor: 'help' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>-23°C</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Temperature</div>
                <Badge variant="info" style={{ marginTop: '4px' }}>Normal</Badge>
              </div>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip 
              content={
                <div>
                  <strong>Communication Signal</strong><br />
                  Strength: 85% (Strong)<br />
                  Latency: 14.2 minutes<br />
                  Last contact: 3 seconds ago<br />
                  Next communication window: 47 minutes
                </div>
              }
              maxWidth={250}
              position="top"
            >
              <div style={{ cursor: 'help' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>85%</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Signal</div>
                <Badge variant="success" style={{ marginTop: '4px' }}>Strong</Badge>
              </div>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Tooltip 
              content={
                <div>
                  <strong>Rover Movement</strong><br />
                  Current speed: 0.3 m/s<br />
                  Max safe speed: 1.2 m/s<br />
                  Distance traveled today: 847m<br />
                  Navigation mode: Autonomous
                </div>
              }
              maxWidth={250}
              position="top"
            >
              <div style={{ cursor: 'help' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>0.3 m/s</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Speed</div>
                <Badge variant="warning" style={{ marginTop: '4px' }}>Moving</Badge>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Control Interface */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tooltip 
            content="Emergency stop will immediately halt all rover operations. Use only in critical situations."
            position="top"
            maxWidth={200}
          >
            <Button variant="danger">Emergency Stop</Button>
          </Tooltip>

          <Tooltip 
            content="Return rover to designated home base using optimal path planning and obstacle avoidance."
            position="top"
            maxWidth={200}
          >
            <Button variant="secondary">Return to Base</Button>
          </Tooltip>

          <Tooltip 
            content="Initiate sample collection sequence at current location. Requires drill deployment."
            position="top"
            maxWidth={200}
          >
            <Button variant="primary">Collect Sample</Button>
          </Tooltip>

          <Tooltip 
            content="Capture 360° panoramic image of current surroundings for geological analysis."
            position="top"
            maxWidth={200}
          >
            <Button variant="tertiary">Take Panorama</Button>
          </Tooltip>
        </div>

        {/* Form with help tooltips */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Navigation Command</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <label htmlFor="latitude">Latitude</label>
                <Tooltip 
                  content="Enter target latitude in decimal degrees. Example: 47.2451 for 47°14'42&quot;N"
                  trigger="click"
                  position="top"
                  maxWidth={200}
                >
                  <span style={{ 
                    cursor: 'help', 
                    color: '#666', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>?</span>
                </Tooltip>
              </div>
              <Input placeholder="47.2451" id="latitude" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <label htmlFor="longitude">Longitude</label>
                <Tooltip 
                  content="Enter target longitude in decimal degrees. Example: -15.8923 for 15°53'32&quot;W"
                  trigger="click"
                  position="top"
                  maxWidth={200}
                >
                  <span style={{ 
                    cursor: 'help', 
                    color: '#666', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>?</span>
                </Tooltip>
              </div>
              <Input placeholder="-15.8923" id="longitude" />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <label htmlFor="speed">Max Speed (m/s)</label>
              <Tooltip 
                content="Maximum allowed speed for this navigation command. Safety systems will override if terrain conditions require slower movement."
                trigger="click"
                position="top"
                maxWidth={220}
              >
                <span style={{ 
                  cursor: 'help', 
                  color: '#666', 
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>?</span>
              </Tooltip>
            </div>
            <Input placeholder="0.5" type="number" step="0.1" id="speed" />
          </div>
        </div>
      </div>
    );
  },
};

// Accessibility features
export const AccessibilityFeatures: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h3>Accessibility Features Demonstration</h3>
      
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip 
          content="This tooltip is properly labeled with aria-describedby for screen readers"
          trigger="hover"
        >
          <Button>Screen Reader Compatible</Button>
        </Tooltip>

        <Tooltip 
          content="Focus this button with Tab key, tooltip will appear automatically"
          trigger="focus"
        >
          <Button>Keyboard Focus Trigger</Button>
        </Tooltip>

        <Tooltip 
          content="Press Escape key to close this tooltip when it's open"
          trigger="click"
        >
          <Button>ESC Key Closes</Button>
        </Tooltip>
      </div>

      <div style={{ 
        padding: '16px', 
        background: '#f0f9ff', 
        border: '1px solid #0284c7',
        borderRadius: '8px' 
      }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Accessibility Features:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>ARIA Support:</strong> Uses <code>aria-describedby</code> to associate tooltip with trigger</li>
          <li><strong>Keyboard Navigation:</strong> Focus trigger shows tooltip, ESC key closes it</li>
          <li><strong>Screen Reader:</strong> Tooltip content is announced when trigger receives focus</li>
          <li><strong>High Contrast:</strong> Tooltip colors adjust for high contrast preferences</li>
          <li><strong>Reduced Motion:</strong> Animations respect prefers-reduced-motion setting</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the comprehensive accessibility features of the Tooltip component:

### ARIA Support
- **aria-describedby**: Associates tooltip content with trigger element
- **role="tooltip"**: Identifies the tooltip for assistive technologies
- **Dynamic Associations**: ARIA attributes are added/removed based on tooltip state

### Keyboard Navigation
- **Focus Trigger**: Tooltips appear when trigger elements receive keyboard focus
- **ESC Key**: Escape key closes open tooltips
- **Tab Navigation**: Maintains natural tab order without trapping focus

### Screen Reader Support
- **Content Announcement**: Tooltip content is announced when trigger is focused
- **State Changes**: Opening/closing states are communicated appropriately
- **Contextual Information**: Provides additional context without cluttering the interface

### Visual Accessibility
- **High Contrast**: Colors automatically adjust for high contrast mode
- **Reduced Motion**: Animations are disabled when user prefers reduced motion
- **Clear Positioning**: Tooltips are positioned to avoid overlapping important content
        `,
      },
    },
  },
};