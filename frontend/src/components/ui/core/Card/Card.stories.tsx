import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Card> = {
  title: 'Core Components/Card',
  component: Card,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The Card component provides a flexible container for grouping related content and actions.

## Features
- **Multiple Variants**: Basic, interactive, and outlined styles
- **Collapsible**: Optional expand/collapse functionality
- **Interactive**: Click handlers and hover states
- **Flexible Layout**: Support for header, content, and footer sections
- **Loading States**: Built-in loading indicator
- **Accessibility**: Full WCAG 2.1 AA compliance with proper ARIA attributes
- **Theming**: Supports all four application themes

## Mission Control Usage
Perfect for displaying telemetry data, system status cards, device information panels, and interactive dashboards in rover mission control interfaces.
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['basic', 'interactive', 'outlined'],
      description: 'Visual variant of the card',
    },
    elevated: {
      control: 'boolean',
      description: 'Whether the card has elevated shadow',
    },
    collapsible: {
      control: 'boolean',
      description: 'Whether the card can be collapsed',
    },
    defaultExpanded: {
      control: 'boolean',
      description: 'Default expanded state for collapsible cards',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the card is disabled',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the card is in loading state',
    },
    header: {
      control: 'text',
      description: 'Card header content',
    },
    footer: {
      control: 'text',
      description: 'Card footer content',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler for interactive cards',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

// Basic variants
export const Basic: Story = {
  args: {
    children: (
      <div>
        <h3 style={{ margin: '0 0 12px 0' }}>Basic Card</h3>
        <p style={{ margin: 0, color: '#666' }}>
          This is a basic card with simple content. Perfect for displaying static information or grouped content.
        </p>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: 'interactive',
    onClick: action('card-clicked'),
    children: (
      <div>
        <h3 style={{ margin: '0 0 12px 0' }}>Interactive Card</h3>
        <p style={{ margin: 0, color: '#666' }}>
          This card is interactive and responds to hover and click events. Try clicking or hovering over it.
        </p>
      </div>
    ),
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: (
      <div>
        <h3 style={{ margin: '0 0 12px 0' }}>Outlined Card</h3>
        <p style={{ margin: 0, color: '#666' }}>
          This card has a border instead of a shadow for a cleaner, more minimal appearance.
        </p>
      </div>
    ),
  },
};

export const Elevated: Story = {
  args: {
    elevated: true,
    children: (
      <div>
        <h3 style={{ margin: '0 0 12px 0' }}>Elevated Card</h3>
        <p style={{ margin: 0, color: '#666' }}>
          This card has an elevated shadow for more prominence and visual hierarchy.
        </p>
      </div>
    ),
  },
};

// With header and footer
export const WithHeaderAndFooter: Story = {
  args: {
    header: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h3 style={{ margin: 0 }}>System Status</h3>
        <Badge variant="success">Online</Badge>
      </div>
    ),
    footer: (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Button variant="tertiary" size="small">
          Details
        </Button>
        <Button variant="primary" size="small">
          Configure
        </Button>
      </div>
    ),
    children: (
      <div>
        <p style={{ margin: '0 0 16px 0' }}>
          All rover systems are operating within normal parameters.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '14px' }}>
          <div>
            <strong>Power:</strong> 87%
          </div>
          <div>
            <strong>Connectivity:</strong> Strong
          </div>
          <div>
            <strong>Temperature:</strong> -23°C
          </div>
          <div>
            <strong>Status:</strong> Nominal
          </div>
        </div>
      </div>
    ),
  },
};

// Collapsible cards
export const Collapsible: Story = {
  render: () => {
    const [expandedState, setExpandedState] = useState<Record<string, boolean>>({
      telemetry: true,
      power: false,
      navigation: true,
    });

    const handleExpandChange = (key: string) => (expanded: boolean) => {
      setExpandedState(prev => ({ ...prev, [key]: expanded }));
      action('expand-change')(key, expanded);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Card
          collapsible
          defaultExpanded={expandedState.telemetry}
          onExpandChange={handleExpandChange('telemetry')}
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0 }}>Telemetry Data</h3>
              <Badge variant="info">Live</Badge>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>87%</div>
              <div style={{ fontSize: '14px', color: '#666' }}>Battery Level</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>-23°C</div>
              <div style={{ fontSize: '14px', color: '#666' }}>Temperature</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>2.4km</div>
              <div style={{ fontSize: '14px', color: '#666' }}>Distance</div>
            </div>
          </div>
        </Card>

        <Card
          collapsible
          defaultExpanded={expandedState.power}
          onExpandChange={handleExpandChange('power')}
          header="Power Systems"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Solar Panels:</span>
              <span style={{ fontWeight: 'bold', color: '#22c55e' }}>124W</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Consumption:</span>
              <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>89W</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Battery Health:</span>
              <span style={{ fontWeight: 'bold', color: '#22c55e' }}>Excellent</span>
            </div>
          </div>
        </Card>

        <Card
          collapsible
          defaultExpanded={expandedState.navigation}
          onExpandChange={handleExpandChange('navigation')}
          header="Navigation Status"
          footer={
            <Button variant="primary" size="small" onClick={() => action('update-waypoint')()}>
              Update Waypoint
            </Button>
          }
        >
          <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
            <div>Current Position:</div>
            <div style={{ marginLeft: '16px', marginBottom: '8px' }}>
              Latitude: 47.2451° N<br />
              Longitude: 15.8923° W<br />
              Altitude: 2,847m
            </div>
            <div>Next Waypoint:</div>
            <div style={{ marginLeft: '16px' }}>
              Distance: 127m<br />
              Bearing: 045° NE<br />
              ETA: 12 minutes
            </div>
          </div>
        </Card>
      </div>
    );
  },
};

// Loading and disabled states
export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
      <Card
        header="Loading State"
        loading={true}
      >
        <p>This card is in a loading state. The content is still visible but interactions are disabled.</p>
      </Card>

      <Card
        header="Disabled State"
        disabled={true}
        footer={
          <Button variant="primary" size="small" disabled>
            Disabled Action
          </Button>
        }
      >
        <p>This card is disabled. All interactions are prevented and the appearance is muted.</p>
      </Card>

      <Card
        variant="interactive"
        header="Interactive Disabled"
        disabled={true}
        onClick={action('should-not-fire')}
      >
        <p>This interactive card is disabled. Click events will not fire.</p>
      </Card>
    </div>
  ),
};

// Mission Control Dashboard
export const MissionControlDashboard: Story = {
  render: () => {
    const [selectedCard, setSelectedCard] = useState<string | null>(null);

    const systemData = [
      {
        id: 'rover-status',
        title: 'Rover Status',
        status: 'operational',
        metrics: {
          'System Health': '98%',
          'Uptime': '47h 23m',
          'Last Contact': '2s ago',
          'Signal Strength': 'Strong',
        },
      },
      {
        id: 'environmental',
        title: 'Environmental',
        status: 'warning',
        metrics: {
          'Temperature': '-23°C',
          'Wind Speed': '45 km/h',
          'Dust Level': 'Moderate',
          'Visibility': '2.1 km',
        },
      },
      {
        id: 'power-systems',
        title: 'Power Systems',
        status: 'operational',
        metrics: {
          'Battery Level': '87%',
          'Solar Input': '124W',
          'Consumption': '89W',
          'Efficiency': '94%',
        },
      },
      {
        id: 'navigation',
        title: 'Navigation',
        status: 'operational',
        metrics: {
          'GPS Signal': 'Locked',
          'Heading': '045° NE',
          'Speed': '0.3 m/s',
          'Distance to Goal': '2.4 km',
        },
      },
    ];

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'operational': return '#22c55e';
        case 'warning': return '#f59e0b';
        case 'error': return '#ef4444';
        default: return '#666';
      }
    };

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'operational': return <Badge variant="success">Operational</Badge>;
        case 'warning': return <Badge variant="warning">Warning</Badge>;
        case 'error': return <Badge variant="error">Error</Badge>;
        default: return <Badge variant="info">Unknown</Badge>;
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Mission Control Dashboard</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {systemData.map((system) => (
            <Card
              key={system.id}
              variant="interactive"
              elevated={selectedCard === system.id}
              onClick={() => {
                setSelectedCard(selectedCard === system.id ? null : system.id);
                action('system-selected')(system.id);
              }}
              header={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <h3 style={{ margin: 0 }}>{system.title}</h3>
                  {getStatusBadge(system.status)}
                </div>
              }
              footer={
                selectedCard === system.id && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button variant="tertiary" size="small" onClick={() => action('view-details')(system.id)}>
                      View Details
                    </Button>
                    <Button variant="primary" size="small" onClick={() => action('configure')(system.id)}>
                      Configure
                    </Button>
                  </div>
                )
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '14px' }}>
                {Object.entries(system.metrics).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#666', fontSize: '12px' }}>{key}</span>
                    <span style={{ fontWeight: 'bold', color: getStatusColor(system.status) }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              
              {selectedCard === system.id && (
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  background: '#f8f9fa', 
                  borderRadius: '6px',
                  fontSize: '14px'
                }}>
                  <strong>Additional Information:</strong><br />
                  Click the action buttons below to view detailed telemetry data or modify system configuration.
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Sample Collection Progress Card */}
        <Card
          collapsible
          defaultExpanded={true}
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0 }}>Sample Collection Progress</h3>
              <Badge variant="info">In Progress</Badge>
            </div>
          }
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="tertiary" size="small" onClick={() => action('pause-collection')()}>
                Pause Collection
              </Button>
              <Button variant="primary" size="small" onClick={() => action('view-samples')()}>
                View Samples
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Progress:</span>
              <span style={{ fontWeight: 'bold' }}>11 of 15 samples (73%)</span>
            </div>
            
            <div style={{ width: '100%', background: '#e5e7eb', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: '73%', 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#666' }}>Estimated Completion:</span><br />
                <strong>2h 15m</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>Current Activity:</span><br />
                <strong>Drilling Sample 12</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>Collection Rate:</span><br />
                <strong>0.27 samples/hour</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  },
};

// Accessibility features
export const AccessibilityFeatures: Story = {
  render: () => {
    const [interactiveCount, setInteractiveCount] = useState(0);
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
      accessible: true,
      keyboard: false,
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3>Accessibility Features Demonstration</h3>
        
        <Card
          variant="interactive"
          onClick={() => {
            setInteractiveCount(prev => prev + 1);
            action('accessible-click')(interactiveCount + 1);
          }}
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h4 style={{ margin: 0 }}>Interactive Card</h4>
              <Badge variant="info">{interactiveCount} clicks</Badge>
            </div>
          }
        >
          <div>
            <p><strong>Keyboard Accessible:</strong> This card can be focused with Tab and activated with Enter or Space.</p>
            <p><strong>Screen Reader Support:</strong> Properly announced as a button with descriptive content.</p>
            <p><strong>Focus Indicators:</strong> Clear visual focus indicators when navigating with keyboard.</p>
          </div>
        </Card>

        <Card
          collapsible
          defaultExpanded={expandedCards.accessible}
          onExpandChange={(expanded) => {
            setExpandedCards(prev => ({ ...prev, accessible: expanded }));
            action('expand-change')('accessible', expanded);
          }}
          header="ARIA Attributes"
        >
          <div>
            <p>This collapsible card demonstrates proper ARIA usage:</p>
            <ul>
              <li><code>aria-expanded</code>: Indicates current expanded state</li>
              <li><code>aria-controls</code>: Links header to content area</li>
              <li><code>aria-hidden</code>: Hides collapsed content from screen readers</li>
              <li><code>role="button"</code>: Identifies interactive elements</li>
            </ul>
          </div>
        </Card>

        <Card
          collapsible
          defaultExpanded={expandedCards.keyboard}
          onExpandChange={(expanded) => {
            setExpandedCards(prev => ({ ...prev, keyboard: expanded }));
            action('expand-change')('keyboard', expanded);
          }}
          header="Keyboard Navigation"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="tertiary" size="small" onClick={() => action('keyboard-action-1')()}>
                Action 1
              </Button>
              <Button variant="primary" size="small" onClick={() => action('keyboard-action-2')()}>
                Action 2
              </Button>
            </div>
          }
        >
          <div>
            <p>Try these keyboard interactions:</p>
            <ul>
              <li><kbd>Tab</kbd>: Navigate to focusable elements</li>
              <li><kbd>Enter</kbd> or <kbd>Space</kbd>: Activate buttons and collapsible headers</li>
              <li><kbd>Shift + Tab</kbd>: Navigate backward</li>
            </ul>
            <p>All interactive elements maintain proper focus order and have clear focus indicators.</p>
          </div>
        </Card>

        <Card
          disabled
          header="Disabled State"
          footer={
            <Button variant="primary" size="small" disabled>
              Disabled Action
            </Button>
          }
        >
          <div>
            <p><strong>Accessibility in Disabled State:</strong></p>
            <ul>
              <li>Properly communicated to screen readers with <code>aria-disabled</code></li>
              <li>Visual styling indicates unavailable state</li>
              <li>Interactive elements are not focusable when disabled</li>
              <li>Maintains semantic structure for assistive technologies</li>
            </ul>
          </div>
        </Card>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the comprehensive accessibility features of the Card component:

### Interactive Cards
- **Keyboard Navigation**: Tab-focusable with Enter/Space activation
- **ARIA Roles**: Proper \`role="button"\` for interactive cards
- **Focus Indicators**: Clear visual focus states

### Collapsible Cards
- **ARIA Expansion**: Uses \`aria-expanded\` to indicate state
- **Content Association**: \`aria-controls\` links header to content
- **Hidden Content**: \`aria-hidden\` properly hides collapsed content
- **Focus Management**: Maintains proper focus order

### Visual Accessibility
- **High Contrast**: Colors adjust for high contrast preferences
- **Reduced Motion**: Animations respect prefers-reduced-motion
- **Disabled States**: Clear visual and programmatic indication

### Screen Reader Support
- **Semantic Structure**: Proper heading hierarchy and content organization
- **Descriptive Content**: Clear, meaningful labels and descriptions
- **State Announcements**: Changes in card state are announced appropriately
        `,
      },
    },
  },
};