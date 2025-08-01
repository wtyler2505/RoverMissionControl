# QuickToolbar Component

The QuickToolbar provides a customizable floating toolbar with mission-critical actions for the Rover Mission Control system. It offers drag-and-drop tool reordering, context-aware tool visibility, accessibility features, and integration with the CommandBar.

## Features

### Core Functionality
- **Customizable Tool Arrangement**: Drag-and-drop reordering of tools
- **Context-Aware Visibility**: Tools show/hide based on rover state and capabilities
- **Multiple Layouts**: Floating, top, bottom, left, right positions with horizontal/vertical orientations
- **Tool Plugin Architecture**: Extensible system for custom tools
- **User Preference Persistence**: Settings saved to localStorage with import/export

### Accessibility (WCAG 2.1 AA Compliant)
- **Keyboard Navigation**: Tab navigation with arrow key support
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **High Contrast Support**: Adjusts to user's contrast preferences
- **Focus Management**: Clear focus indicators and logical tab order
- **Reduced Motion**: Respects user's motion preferences

### Integration
- **CommandBar Integration**: Complex operations can delegate to CommandBar
- **Theme System**: Fully integrated with the design system
- **Responsive Design**: Adapts to different screen sizes and orientations

## Usage

### Basic Implementation

```tsx
import { QuickToolbar, RoverContext } from '@/components/layout/MissionControl';

const roverContext: RoverContext = {
  isConnected: true,
  currentState: 'operational',
  capabilities: ['navigation', 'sampling', 'imaging'],
  batteryLevel: 85,
  isEmergency: false,
  activeCommands: [],
  permissions: ['navigate', 'sample', 'image']
};

function MissionControl() {
  return (
    <QuickToolbar
      roverContext={roverContext}
      onToolExecute={(tool) => console.log('Executing:', tool.name)}
      onPreferencesChange={(prefs) => console.log('Preferences updated:', prefs)}
    />
  );
}
```

### Custom Tools

```tsx
import { ToolAction } from '@/components/layout/MissionControl';

const customTools: ToolAction[] = [
  {
    id: 'thermal-scan',
    name: 'Thermal Scan',
    category: 'diagnostic',
    description: 'Perform thermal imaging scan',
    icon: '🌡️',
    shortcut: 'Ctrl+T',
    state: 'enabled',
    contextRequirements: ['thermal_camera'],
    onExecute: async () => {
      // Custom tool logic
      await performThermalScan();
    },
    isVisible: (context) => context.capabilities.includes('thermal_imaging')
  }
];

<QuickToolbar
  roverContext={roverContext}
  tools={customTools}
/>
```

### Layout Customization

```tsx
const customLayout = {
  position: 'bottom' as const,
  orientation: 'horizontal' as const,
  size: 'large' as const,
  showLabels: true,
  autoHide: false,
  maxTools: 10
};

<QuickToolbar
  roverContext={roverContext}
  initialLayout={customLayout}
/>
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `roverContext` | `RoverContext` | - | Current rover state and context |
| `tools` | `ToolAction[]` | `DEFAULT_TOOLS` | Available tool actions |
| `groups` | `ToolGroup[]` | `[]` | Tool groups for organization |
| `initialLayout` | `Partial<ToolbarLayout>` | `DEFAULT_LAYOUT` | Initial toolbar layout |
| `preferences` | `Partial<ToolbarPreferences>` | `{}` | User preferences |
| `onToolExecute` | `(tool: ToolAction, params?: any) => Promise<void>` | - | Tool execution callback |
| `onPreferencesChange` | `(preferences: ToolbarPreferences) => void` | - | Preferences change callback |
| `onCommandBarIntegration` | `(command: string) => void` | - | CommandBar integration callback |

### Types

#### ToolAction
```tsx
interface ToolAction {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  state: ToolState;
  confirmationRequired?: boolean;
  dangerLevel?: 'low' | 'medium' | 'high' | 'critical';
  contextRequirements?: string[];
  onExecute: (params?: any) => Promise<void> | void;
  onCancel?: () => void;
  isVisible?: (context: RoverContext) => boolean;
  metadata?: Record<string, any>;
}
```

#### RoverContext
```tsx
interface RoverContext {
  isConnected: boolean;
  currentState: string;
  capabilities: string[];
  batteryLevel: number;
  location?: { x: number; y: number; z: number };
  isEmergency: boolean;
  activeCommands: string[];
  permissions: string[];
}
```

#### ToolbarLayout
```tsx
interface ToolbarLayout {
  position: 'top' | 'bottom' | 'left' | 'right' | 'floating';
  orientation: 'horizontal' | 'vertical';
  size: 'small' | 'medium' | 'large';
  showLabels: boolean;
  autoHide: boolean;
  maxTools: number;
}
```

## Tool Categories

- **safety**: Emergency and safety-critical tools (Emergency Stop, Safe Mode)
- **navigation**: Movement and positioning tools (Home, Waypoint Navigation)
- **sampling**: Sample collection and analysis tools (Collect Sample, Soil Analysis)
- **system**: System operations and status tools (Camera Capture, Status Report)
- **communication**: Communication and data transfer tools
- **diagnostic**: Diagnostic and maintenance tools
- **custom**: User-defined custom tools

## Built-in Tools

### Safety Tools
- **Emergency Stop**: Immediately halt all rover operations (Ctrl+Shift+X)
- **Safe Mode**: Enter safe operational mode

### Navigation Tools
- **Return Home**: Navigate rover back to home position (Ctrl+H)
- **Navigate to Waypoint**: Navigate to selected waypoint (Ctrl+N)

### Sampling Tools
- **Collect Sample**: Activate sample collection mechanism (Ctrl+S)
- **Store Sample**: Store collected sample in rover storage

### System Tools
- **Capture Image**: Take photo with rover camera (Ctrl+C)
- **Status Report**: Generate comprehensive system status report (Ctrl+R)

## Keyboard Shortcuts

### Global Shortcuts
- **Ctrl+K**: Focus toolbar (if visible)
- **Tab**: Navigate between tools
- **Arrow Keys**: Navigate tools directionally
- **Enter/Space**: Execute focused tool
- **Escape**: Exit tool navigation

### Tool Shortcuts
Each tool can define custom keyboard shortcuts (e.g., Ctrl+H for Home, Ctrl+X for Emergency Stop).

## Customization

### Tool Selection
Users can select which tools to display from the available tool set. Tools are filtered based on:
- Current rover capabilities
- User permissions
- Context requirements
- Visibility rules

### Layout Options
- **Position**: floating, top, bottom, left, right
- **Orientation**: horizontal, vertical
- **Size**: small (32px), medium (48px), large (64px)
- **Labels**: Show/hide tool labels
- **Auto-hide**: Automatically hide when not in use
- **Max Tools**: Limit number of visible tools

### Drag and Drop
Tools can be reordered by dragging them to new positions. Drop zones appear during drag operations to guide placement.

## Context-Aware Behavior

### Emergency State
- Only safety-critical tools are enabled
- Other tools are disabled with visual feedback
- Emergency tools are highlighted

### Disconnected State
- All tools except diagnostics are disabled
- Visual indicators show disconnection status
- Reconnection tools remain available

### Limited Capabilities
- Tools requiring unavailable capabilities are hidden
- Remaining tools adapt to available functions
- Clear feedback about limitations

## Accessibility Features

### Keyboard Navigation
- Full keyboard navigation support
- Logical tab order
- Arrow key navigation within toolbar
- Enter/Space for activation
- Escape to exit

### Screen Reader Support
- Comprehensive ARIA labels
- Status announcements
- Tool descriptions and shortcuts
- Current state information

### Visual Accessibility
- High contrast mode support
- Focus indicators
- Status indicators
- Clear visual hierarchy

### Motion Accessibility
- Respects reduced motion preferences
- Optional animations
- Static layouts available

## Plugin Architecture

### Creating Custom Tools
```tsx
const customTool: ToolAction = {
  id: 'my-custom-tool',
  name: 'Custom Tool',
  category: 'custom',
  description: 'My custom functionality',
  icon: '⚡',
  state: 'enabled',
  metadata: {
    plugin: 'my-plugin',
    version: '1.0.0'
  },
  onExecute: async () => {
    // Custom implementation
  }
};
```

### Tool Registration
Tools can be registered dynamically:
```tsx
const [tools, setTools] = useState(DEFAULT_TOOLS);

// Add custom tool
setTools(prevTools => [...prevTools, customTool]);
```

## Performance Considerations

### Rendering Optimization
- Tools are memoized to prevent unnecessary re-renders
- Context changes trigger selective updates
- Drag operations use optimized event handlers

### Memory Management
- Event listeners are properly cleaned up
- References are cleared on unmount
- localStorage operations are debounced

### Responsive Performance
- Layout calculations are optimized
- Responsive breakpoints minimize recalculations
- Touch interactions are optimized for mobile

## Testing

### Unit Tests
```bash
npm test QuickToolbar.test.tsx
```

### Storybook Stories
```bash
npm run storybook
# Navigate to Mission Control -> QuickToolbar
```

### Accessibility Testing
```bash
npm run test:a11y
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Migration Guide

### From v1.x to v2.x
- `toolOrder` prop renamed to `preferences.toolOrder`
- `onToolChange` callback replaced with `onPreferencesChange`
- Layout configuration moved to `preferences.layout`

### Updating Custom Tools
```tsx
// v1.x
const tool = {
  id: 'tool',
  execute: () => {}
};

// v2.x
const tool = {
  id: 'tool',
  onExecute: async () => {}
};
```

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure accessibility compliance
5. Test with keyboard navigation and screen readers

## License

This component is part of the Rover Mission Control system and follows the project's licensing terms.