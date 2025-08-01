import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { TelemetrySidebar } from './TelemetrySidebar';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { themes } from '../../../theme/themes';
import { useState } from 'react';

// Mock data for stories
const mockSystemStatus = [
  {
    id: 'power',
    system: 'Power Systems',
    status: 'online' as const,
    message: 'Battery: 87%, Solar: Active',
  },
  {
    id: 'communication',
    system: 'Communication',
    status: 'online' as const,
    message: 'Signal: Strong, Latency: 2.3s',
  },
  {
    id: 'navigation',
    system: 'Navigation',
    status: 'warning' as const,
    message: 'GPS accuracy reduced',
    alerts: 1,
  },
  {
    id: 'instruments',
    system: 'Science Instruments',
    status: 'online' as const,
    message: 'All instruments operational',
  },
  {
    id: 'thermal',
    system: 'Thermal Control',
    status: 'critical' as const,
    message: 'Temperature exceeding safe limits',
    alerts: 3,
  },
];

const mockTelemetryData = [
  {
    id: 'temp',
    label: 'Temperature',
    value: 23.5,
    unit: '°C',
    status: 'normal' as const,
    timestamp: new Date(),
  },
  {
    id: 'battery',
    label: 'Battery',
    value: 87,
    unit: '%',
    status: 'normal' as const,
    timestamp: new Date(),
  },
  {
    id: 'signal',
    label: 'Signal',
    value: -45,
    unit: 'dBm',
    status: 'normal' as const,
    timestamp: new Date(),
  },
  {
    id: 'speed',
    label: 'Speed',
    value: 0.8,
    unit: 'm/s',
    status: 'normal' as const,
    timestamp: new Date(),
  },
  {
    id: 'pressure',
    label: 'Pressure',
    value: 1013.2,
    unit: 'hPa',
    status: 'warning' as const,
    timestamp: new Date(),
  },
  {
    id: 'altitude',
    label: 'Altitude',
    value: 152,
    unit: 'm',
    status: 'critical' as const,
    timestamp: new Date(),
  },
];

// Icons for quick actions
const CommandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" />
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const SampleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

const mockQuickActions = [
  {
    id: 'start',
    label: 'Start Mission',
    icon: <CommandIcon />,
    action: action('start-mission'),
  },
  {
    id: 'stop',
    label: 'Emergency Stop',
    icon: <StopIcon />,
    action: action('emergency-stop'),
  },
  {
    id: 'camera',
    label: 'Take Photo',
    icon: <CameraIcon />,
    action: action('take-photo'),
  },
  {
    id: 'sample',
    label: 'Collect Sample',
    icon: <SampleIcon />,
    action: action('collect-sample'),
    disabled: true,
  },
];

const meta: Meta<typeof TelemetrySidebar> = {
  title: 'Layout/MissionControl/TelemetrySidebar',
  component: TelemetrySidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The TelemetrySidebar component provides a collapsible sidebar with real-time telemetry data, 
system status, and quick actions for rover mission control. It features:

- **Collapsible Design**: Smooth animations with both expanded and collapsed states
- **Multiple Sections**: System Status, Telemetry Data, Quick Actions, and Settings
- **Real-time Updates**: Support for live data updates with visual indicators
- **Accessibility**: Full keyboard navigation and WCAG 2.1 AA compliance
- **State Persistence**: Remembers collapsed state using localStorage
- **Badge Indicators**: Visual alerts and notification counts
- **Responsive**: Adapts to mobile/tablet viewports
- **Theme Support**: Works with all theme variants

The component is designed for mission-critical rover control interfaces where reliability 
and usability are paramount.
        `,
      },
    },
  },
  argTypes: {
    defaultCollapsed: {
      control: 'boolean',
      description: 'Whether the sidebar starts in collapsed state',
    },
    systemStatus: {
      control: 'object',
      description: 'Array of system status items',
    },
    telemetryData: {
      control: 'object', 
      description: 'Array of telemetry data points',
    },
    quickActions: {
      control: 'object',
      description: 'Array of quick action buttons',
    },
    persistState: {
      control: 'boolean',
      description: 'Whether to persist collapsed state in localStorage',
    },
    expandedWidth: {
      control: { type: 'number', min: 200, max: 500, step: 10 },
      description: 'Width of expanded sidebar in pixels',
    },
    collapsedWidth: {
      control: { type: 'number', min: 40, max: 100, step: 4 },
      description: 'Width of collapsed sidebar in pixels',
    },
  },
  decorators: [
    (Story, context) => (
      <ThemeProvider themeName="default">
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
          <div style={{ 
            padding: '2rem', 
            backgroundColor: themes.default.colors.background.default,
            height: '100%',
            overflow: 'hidden'
          }}>
            <h1 style={{ color: themes.default.colors.text.primary }}>
              Mission Control Dashboard
            </h1>
            <p style={{ color: themes.default.colors.text.secondary }}>
              This is the main content area. The sidebar will overlay on the right side.
            </p>
            <Story />
          </div>
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with expanded sidebar
export const Default: Story = {
  args: {
    defaultCollapsed: false,
    systemStatus: mockSystemStatus,
    telemetryData: mockTelemetryData,
    quickActions: mockQuickActions,
    persistState: false,
    onCollapseChange: action('collapse-change'),
  },
};

// Collapsed state story
export const Collapsed: Story = {
  args: {
    ...Default.args,
    defaultCollapsed: true,
  },
};

// With minimal data
export const MinimalData: Story = {
  args: {
    defaultCollapsed: false,
    systemStatus: mockSystemStatus.slice(0, 2),
    telemetryData: mockTelemetryData.slice(0, 3),
    quickActions: mockQuickActions.slice(0, 2),
    persistState: false,
    onCollapseChange: action('collapse-change'),
  },
};

// With no alerts
export const NoAlerts: Story = {
  args: {
    defaultCollapsed: false,
    systemStatus: mockSystemStatus.map(status => ({ ...status, alerts: undefined, status: 'online' as const })),
    telemetryData: mockTelemetryData.map(data => ({ ...data, status: 'normal' as const })),
    quickActions: mockQuickActions,
    persistState: false,
    onCollapseChange: action('collapse-change'),
  },
};

// High alert state
export const HighAlerts: Story = {
  args: {
    defaultCollapsed: false,
    systemStatus: mockSystemStatus.map(status => ({ 
      ...status, 
      alerts: Math.floor(Math.random() * 5) + 1,
      status: Math.random() > 0.5 ? 'critical' as const : 'warning' as const
    })),
    telemetryData: mockTelemetryData.map(data => ({ 
      ...data, 
      status: Math.random() > 0.5 ? 'critical' as const : 'warning' as const 
    })),
    quickActions: mockQuickActions,
    persistState: false,
    onCollapseChange: action('collapse-change'),
  },
};

// Custom dimensions
export const CustomDimensions: Story = {
  args: {
    ...Default.args,
    expandedWidth: 400,
    collapsedWidth: 80,
  },
};

// Interactive state story
export const Interactive: Story = {
  render: (args) => {
    const [collapsed, setCollapsed] = useState(args.defaultCollapsed || false);
    
    return (
      <TelemetrySidebar
        {...args}
        defaultCollapsed={collapsed}
        onCollapseChange={(newCollapsed) => {
          setCollapsed(newCollapsed);
          action('collapse-change')(newCollapsed);
        }}
        persistState={false}
      />
    );
  },
  args: {
    systemStatus: mockSystemStatus,
    telemetryData: mockTelemetryData,
    quickActions: mockQuickActions,
  },
};

// Dark theme story
export const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider themeName="dark">
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
          <div style={{ 
            padding: '2rem', 
            backgroundColor: themes.dark.colors.background.default,
            height: '100%',
            overflow: 'hidden'
          }}>
            <h1 style={{ color: themes.dark.colors.text.primary }}>
              Mission Control Dashboard - Dark Theme
            </h1>
            <p style={{ color: themes.dark.colors.text.secondary }}>
              Space operations optimized theme.
            </p>
            <Story />
          </div>
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    ...Default.args,
  },
};

// High contrast theme story
export const HighContrast: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider themeName="highContrast">
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
          <div style={{ 
            padding: '2rem', 
            backgroundColor: themes.highContrast.colors.background.default,
            height: '100%',
            overflow: 'hidden'
          }}>
            <h1 style={{ color: themes.highContrast.colors.text.primary }}>
              Mission Control Dashboard - High Contrast
            </h1>
            <p style={{ color: themes.highContrast.colors.text.secondary }}>
              Accessibility optimized theme.
            </p>
            <Story />
          </div>
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    ...Default.args,
  },
};

// Mission critical theme story
export const MissionCritical: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider themeName="missionCritical">
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
          <div style={{ 
            padding: '2rem', 
            backgroundColor: themes.missionCritical.colors.background.default,
            height: '100%',
            overflow: 'hidden'
          }}>
            <h1 style={{ color: themes.missionCritical.colors.text.primary }}>
              Mission Control Dashboard - Mission Critical
            </h1>
            <p style={{ color: themes.missionCritical.colors.text.secondary }}>
              Emergency operations theme.
            </p>
            <Story />
          </div>
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    ...HighAlerts.args,
  },
};

// Real-time data simulation
export const RealTimeSimulation: Story = {
  render: (args) => {
    const [telemetryData, setTelemetryData] = useState(mockTelemetryData);
    const [systemStatus, setSystemStatus] = useState(mockSystemStatus);
    
    // Simulate real-time updates
    React.useEffect(() => {
      const interval = setInterval(() => {
        setTelemetryData(prev => prev.map(item => ({
          ...item,
          value: typeof item.value === 'number' 
            ? Math.max(0, item.value + (Math.random() - 0.5) * 10)
            : item.value,
          timestamp: new Date(),
        })));
        
        // Occasionally change system status
        if (Math.random() > 0.8) {
          setSystemStatus(prev => prev.map(item => ({
            ...item,
            status: Math.random() > 0.7 ? 'warning' as const : 'online' as const,
          })));
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }, []);
    
    return (
      <TelemetrySidebar
        {...args}
        systemStatus={systemStatus}
        telemetryData={telemetryData}
        persistState={false}
        onCollapseChange={action('collapse-change')}
      />
    );
  },
  args: {
    defaultCollapsed: false,
    quickActions: mockQuickActions,
  },
  parameters: {
    docs: {
      description: {
        story: 'Simulates real-time telemetry data updates every 2 seconds.',
      },
    },
  },
};