import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';
import { Button } from '../Button';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Badge> = {
  title: 'Core Components/Badge',
  component: Badge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The Badge component displays small numeric or text values, typically used to show counts, status, or other supplementary information.

## Features
- **Multiple Variants**: Primary, secondary, success, warning, error, info, and neutral styles
- **Dot Mode**: Show as a simple dot indicator without text
- **Numeric Handling**: Automatic truncation for large numbers (99+)
- **Zero Handling**: Optional display of zero values
- **Invisible State**: Hide badge when not needed
- **Accessibility**: Proper ARIA attributes and screen reader support
- **Theming**: Supports all four application themes

## Mission Control Usage
Perfect for showing notification counts, system status indicators, alert levels, and data point markers in rover mission control interfaces.
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'neutral'],
      description: 'Visual variant of the badge',
    },
    children: {
      control: 'text',
      description: 'Badge content (text or number)',
    },
    dot: {
      control: 'boolean',
      description: 'Display as a dot without text',
    },
    max: {
      control: { type: 'number', min: 1, max: 999 },
      description: 'Maximum number before showing "max+"',
    },
    showZero: {
      control: 'boolean',
      description: 'Whether to show badge when value is 0',
    },
    invisible: {
      control: 'boolean',
      description: 'Hide the badge completely',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Badge>;

// Basic variants
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="neutral">Neutral</Badge>
    </div>
  ),
};

// With numbers
export const WithNumbers: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge variant="primary">1</Badge>
      <Badge variant="success">5</Badge>
      <Badge variant="warning">42</Badge>
      <Badge variant="error">99</Badge>
      <Badge variant="info">100</Badge>
      <Badge variant="neutral">999</Badge>
    </div>
  ),
};

// Dot badges
export const DotBadges: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="success" dot />
        <span>Online</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="warning" dot />
        <span>Warning</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="error" dot />
        <span>Offline</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="info" dot />
        <span>Processing</span>
      </div>
    </div>
  ),
};

// With max values
export const MaxValues: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge variant="primary" max={9}>5</Badge>
      <Badge variant="primary" max={9}>15</Badge>
      <Badge variant="warning" max={99}>50</Badge>
      <Badge variant="warning" max={99}>150</Badge>
      <Badge variant="error" max={999}>500</Badge>
      <Badge variant="error" max={999}>1500</Badge>
    </div>
  ),
};

// Zero handling
export const ZeroHandling: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="primary" showZero={false}>0</Badge>
        <span>Hidden when zero (default)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="primary" showZero={true}>0</Badge>
        <span>Shown when zero</span>
      </div>
    </div>
  ),
};

// Interactive badges
export const Interactive: Story = {
  render: () => {
    const [counts, setCounts] = useState({
      notifications: 3,
      alerts: 0,
      messages: 12,
      errors: 1,
    });

    const increment = (key: keyof typeof counts) => {
      setCounts(prev => ({ ...prev, [key]: prev[key] + 1 }));
      action('increment')(key, counts[key] + 1);
    };

    const reset = (key: keyof typeof counts) => {
      setCounts(prev => ({ ...prev, [key]: 0 }));
      action('reset')(key);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="tertiary" onClick={() => increment('notifications')}>
              Notifications
            </Button>
            <Badge 
              variant="primary" 
              style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px',
                transform: counts.notifications === 0 ? 'scale(0)' : 'scale(1)'
              }}
            >
              {counts.notifications}
            </Badge>
          </div>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="tertiary" onClick={() => increment('alerts')}>
              Alerts
            </Button>
            <Badge 
              variant="warning" 
              style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px',
                transform: counts.alerts === 0 ? 'scale(0)' : 'scale(1)'
              }}
            >
              {counts.alerts}
            </Badge>
          </div>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="tertiary" onClick={() => increment('messages')}>
              Messages
            </Button>
            <Badge 
              variant="info" 
              style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px',
                transform: counts.messages === 0 ? 'scale(0)' : 'scale(1)'
              }}
              max={99}
            >
              {counts.messages}
            </Badge>
          </div>

          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="tertiary" onClick={() => increment('errors')}>
              Errors
            </Button>
            <Badge 
              variant="error" 
              style={{ 
                position: 'absolute', 
                top: '-8px', 
                right: '-8px',
                transform: counts.errors === 0 ? 'scale(0)' : 'scale(1)'
              }}
            >
              {counts.errors}
            </Badge>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="small" variant="ghost" onClick={() => reset('notifications')}>
            Clear Notifications
          </Button>
          <Button size="small" variant="ghost" onClick={() => reset('alerts')}>
            Clear Alerts
          </Button>
          <Button size="small" variant="ghost" onClick={() => reset('messages')}>
            Clear Messages
          </Button>
          <Button size="small" variant="ghost" onClick={() => reset('errors')}>
            Clear Errors
          </Button>
        </div>
      </div>
    );
  },
};

// Mission Control Status Indicators
export const MissionControlScenarios: Story = {
  render: () => {
    const systemData = [
      { name: 'Power Systems', status: 'operational', alerts: 0, variant: 'success' as const },
      { name: 'Navigation', status: 'warning', alerts: 2, variant: 'warning' as const },
      { name: 'Communication', status: 'operational', alerts: 0, variant: 'success' as const },
      { name: 'Sensors', status: 'error', alerts: 5, variant: 'error' as const },
      { name: 'Mobility', status: 'operational', alerts: 0, variant: 'success' as const },
      { name: 'Sample Collection', status: 'processing', alerts: 1, variant: 'info' as const },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ margin: 0 }}>Rover System Status Dashboard</h3>
        
        {/* System Status Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          {systemData.map((system) => (
            <div 
              key={system.name}
              style={{ 
                padding: '16px', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                background: '#f9fafb'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                  {system.name}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge variant={system.variant} dot />
                  {system.alerts > 0 && (
                    <Badge variant="error" max={99}>
                      {system.alerts}
                    </Badge>
                  )}
                </div>
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#666',
                textTransform: 'capitalize'
              }}>
                Status: {system.status}
              </div>
            </div>
          ))}
        </div>

        {/* Mission Progress */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #d1d5db', 
          borderRadius: '8px',
          background: 'white'
        }}>
          <h4 style={{ margin: '0 0 16px 0' }}>Current Mission Progress</h4>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>Samples Collected:</span>
              <Badge variant="success">11</Badge>
              <span style={{ fontSize: '12px', color: '#666' }}>/ 15 target</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>Distance Traveled:</span>
              <Badge variant="info">2.4km</Badge>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>Mission Days:</span>
              <Badge variant="primary">47</Badge>
              <span style={{ fontSize: '12px', color: '#666' }}>/ 90 planned</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>Data Transmitted:</span>
              <Badge variant="secondary" max={999}>1247</Badge>
              <span style={{ fontSize: '12px', color: '#666' }}>MB</span>
            </div>
          </div>
        </div>

        {/* Alert Summary */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #fef3c7', 
          borderRadius: '8px',
          background: '#fffbeb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Active Alerts</h4>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Badge variant="error" dot />
                <span style={{ fontSize: '14px' }}>Critical:</span>
                <Badge variant="error">2</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Badge variant="warning" dot />
                <span style={{ fontSize: '14px' }}>Warning:</span>
                <Badge variant="warning">5</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Badge variant="info" dot />
                <span style={{ fontSize: '14px' }}>Info:</span>
                <Badge variant="info">12</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Communication Status */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '16px',
          padding: '16px',
          background: '#f3f4f6',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
              Signal Strength
            </div>
            <Badge variant="success">Strong</Badge>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
              Pending Commands
            </div>
            <Badge variant="warning">3</Badge>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
              Queue Status
            </div>
            <Badge variant="info" dot />
            <span style={{ marginLeft: '8px', fontSize: '12px' }}>Processing</span>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
              Uplink Rate
            </div>
            <Badge variant="primary">2.4</Badge>
            <span style={{ marginLeft: '4px', fontSize: '12px' }}>Kbps</span>
          </div>
        </div>
      </div>
    );
  },
};

// Positioning examples
export const Positioning: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <h3 style={{ margin: 0 }}>Badge Positioning Examples</h3>
      
      {/* Button badges */}
      <div>
        <h4 style={{ marginBottom: '16px' }}>Button Badges</h4>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button>Notifications</Button>
            <Badge variant="error" style={{ position: 'absolute', top: '-8px', right: '-8px' }}>
              5
            </Badge>
          </div>
          
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="secondary">Messages</Button>
            <Badge variant="primary" style={{ position: 'absolute', top: '-8px', right: '-8px' }} max={99}>
              127
            </Badge>
          </div>
          
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="tertiary">Status</Button>
            <Badge variant="success" dot style={{ position: 'absolute', top: '4px', right: '4px' }} />
          </div>
        </div>
      </div>

      {/* Inline badges */}
      <div>
        <h4 style={{ marginBottom: '16px' }}>Inline Badges</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>System Health</span>
            <Badge variant="success">Excellent</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Battery Level</span>
            <Badge variant="warning">Low</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Connection Status</span>
            <Badge variant="error" dot />
            <span style={{ fontSize: '14px', color: '#666' }}>Disconnected</span>
          </div>
        </div>
      </div>

      {/* List item badges */}
      <div>
        <h4 style={{ marginBottom: '16px' }}>List Item Badges</h4>
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          overflow: 'hidden' 
        }}>
          {[
            { name: 'System Alerts', count: 3, variant: 'error' as const },
            { name: 'Mission Updates', count: 7, variant: 'info' as const },
            { name: 'Data Backlog', count: 156, variant: 'warning' as const },
            { name: 'Completed Tasks', count: 24, variant: 'success' as const },
          ].map((item, index) => (
            <div 
              key={item.name}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: index < 3 ? '1px solid #e5e7eb' : 'none'
              }}
            >
              <span>{item.name}</span>
              <Badge variant={item.variant} max={99}>
                {item.count}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
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
        <h4 style={{ margin: '0 0 12px 0' }}>Badge Accessibility Features:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>ARIA Hidden:</strong> Decorative badges are hidden from screen readers when appropriate</li>
          <li><strong>Semantic Content:</strong> Meaningful text content is announced by screen readers</li>
          <li><strong>High Contrast:</strong> Colors and borders adjust for high contrast preferences</li>
          <li><strong>Context Preservation:</strong> Badge content maintains context with surrounding elements</li>
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Mission Critical Systems</span>
          <Badge variant="success" aria-label="All systems operational">
            ✓ Operational
          </Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Unread Notifications</span>
          <Badge variant="error" aria-label="5 unread notifications">
            5
          </Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant="warning" dot aria-label="Warning status indicator" />
          <span>Temperature sensors require calibration</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Data Processing Queue</span>
          <Badge variant="info" max={99} aria-label="127 items in processing queue">
            127
          </Badge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the accessibility features of the Badge component:

### Screen Reader Support
- **Meaningful Labels**: Use \`aria-label\` to provide context for numeric or symbolic badges
- **ARIA Hidden**: Decorative badges can be hidden from screen readers when they don't add value
- **Contextual Information**: Badges work with surrounding text to provide complete information

### Visual Accessibility
- **High Contrast**: Badge colors automatically adjust for high contrast mode
- **Clear Differentiation**: Color is not the only means of conveying information
- **Readable Text**: Sufficient contrast ratios between text and background

### Best Practices
- Always provide context for numeric badges (what does the number represent?)
- Use descriptive labels for dot indicators
- Ensure badge content is meaningful when read aloud
- Consider whether the badge adds valuable information for screen reader users
        `,
      },
    },
  },
};