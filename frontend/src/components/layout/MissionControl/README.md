# MainVisualizationPanel Component

The `MainVisualizationPanel` is the primary 3D visualization component for the Mission Control Center, designed to occupy 60% of the screen in desktop view and provide mission-critical rover visualization capabilities.

## Features

### Core Functionality
- **Multiple Visualization Modes**: 3D, Map, and Data views with smooth switching
- **Three.js Integration**: Ready-to-use placeholder for 3D rover visualization
- **Drag & Drop Support**: Configurable drag-and-drop interactions
- **Context Menu**: Rich context menu with panel options (fullscreen, settings, export, reset)
- **Responsive Design**: Adaptive layout for desktop (60%), tablet (100%), and mobile (100%)

### Accessibility (WCAG 2.1 AA Compliant)
- **ARIA Labels**: Proper semantic markup and screen reader support
- **Keyboard Navigation**: Full keyboard support with shortcuts
- **Focus Management**: Logical tab order and focus indicators
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects user's motion preferences

### Enterprise Features
- **Loading States**: Elegant loading indicators
- **Error Handling**: Comprehensive error states with retry functionality
- **Customizable**: Extensive configuration options
- **Performance Optimized**: Efficient rendering and responsive updates

## Usage

### Basic Usage

```tsx
import { MainVisualizationPanel } from '@/components/layout/MissionControl';

function MissionControl() {
  return (
    <MainVisualizationPanel
      id="main-viz"
      mode="3d"
      onModeChange={(mode) => console.log(`Mode changed to: ${mode}`)}
      onFullscreenToggle={() => setFullscreen(!isFullscreen)}
    />
  );
}
```

### Advanced Configuration

```tsx
import { MainVisualizationPanel } from '@/components/layout/MissionControl';

function AdvancedMissionControl() {
  const threeJSConfig = {
    enableOrbitControls: true,
    enableGrid: true,
    enableAxes: true,
    backgroundColor: '#1a1a2e',
    cameraPosition: [15, 15, 15],
    fieldOfView: 70
  };

  const dragDropConfig = {
    enableDragToReposition: true,
    enableDropZones: true,
    dragThreshold: 3,
    snapToGrid: true
  };

  const customContextMenuItems = [
    {
      id: 'screenshot',
      label: 'Capture Screenshot',
      icon: '📸',
      shortcut: 'Ctrl+Shift+S',
      action: () => captureScreenshot()
    }
  ];

  return (
    <MainVisualizationPanel
      id="advanced-viz"
      mode="3d"
      threeJSConfig={threeJSConfig}
      dragDropConfig={dragDropConfig}
      customContextMenuItems={customContextMenuItems}
      visualizationData={roverData}
      onModeChange={handleModeChange}
      onFullscreenToggle={handleFullscreen}
      onSettings={openSettings}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | Required | Unique identifier for the panel |
| `mode` | `'3d' \| 'map' \| 'data'` | `'3d'` | Current visualization mode |
| `onModeChange` | `(mode: VisualizationMode) => void` | - | Callback when mode changes |
| `threeJSConfig` | `Partial<ThreeJSConfig>` | Default config | Three.js configuration options |
| `dragDropConfig` | `Partial<DragDropConfig>` | Default config | Drag and drop settings |
| `customContextMenuItems` | `ContextMenuItem[]` | `[]` | Additional context menu items |
| `isFullscreen` | `boolean` | `false` | Whether panel is in fullscreen mode |
| `onFullscreenToggle` | `() => void` | - | Fullscreen toggle callback |
| `isLoading` | `boolean` | `false` | Loading state |
| `error` | `string` | - | Error message to display |
| `visualizationData` | `any` | - | Data for visualization |
| `className` | `string` | `''` | Custom CSS class name |
| `testId` | `string` | - | Test identifier |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F11` | Toggle fullscreen |
| `Ctrl+1` | Switch to 3D mode |
| `Ctrl+2` | Switch to Map mode |
| `Ctrl+3` | Switch to Data mode |
| `Ctrl+R` | Reset view |
| `Escape` | Close context menu / Exit fullscreen |

## Responsive Behavior

- **Desktop (≥1200px)**: 60% width, full feature set
- **Tablet (768px-1199px)**: 100% width, reorganized controls
- **Mobile (<768px)**: 100% width, stacked layout

## Three.js Integration

The component includes a placeholder container ready for Three.js implementation:

```tsx
// The Three.js container is accessible via ref
const threeJSContainerRef = useRef<HTMLDivElement>(null);

// Initialize Three.js in useEffect
useEffect(() => {
  if (currentMode === '3d' && threeJSContainerRef.current) {
    // Initialize Three.js scene here
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      mergedThreeJSConfig.fieldOfView,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    // ... rest of Three.js setup
  }
}, [currentMode, mergedThreeJSConfig]);
```

## Accessibility Features

### Screen Reader Support
- Semantic HTML structure with proper landmarks
- ARIA labels for all interactive elements
- Live regions for dynamic content announcements
- Descriptive alt text for visual content

### Keyboard Navigation
- Full keyboard accessibility with logical tab order
- Keyboard shortcuts for common actions
- Focus indicators and proper focus management
- Skip links for efficient navigation

### High Contrast & Motion
- CSS custom properties for theme customization
- Support for `prefers-contrast: high`
- Respect for `prefers-reduced-motion: reduce`
- Scalable text and touch targets

## Testing

The component includes comprehensive test coverage:

```bash
# Run unit tests
npm test MainVisualizationPanel.test.tsx

# Run Storybook for visual testing
npm run storybook
```

## Integration with Grid System

The component is designed to work seamlessly with the existing Grid system:

```tsx
import { GridContainer, MainVisualizationPanel } from '@/components';

function MissionControlLayout() {
  return (
    <GridContainer>
      <MainVisualizationPanel
        id="main-viz"
        layout={{ i: 'visualization', x: 0, y: 0, w: 8, h: 6 }}
        gridRef={gridRef}
      />
    </GridContainer>
  );
}
```

## Performance Considerations

- Component uses React.memo for optimized re-renders
- Event handlers are memoized with useCallback
- Responsive behavior uses efficient resize observers
- Drag and drop operations are throttled
- Context menu uses event delegation

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

When modifying this component:

1. Maintain accessibility standards (WCAG 2.1 AA)
2. Update tests for new functionality
3. Add Storybook stories for new states
4. Ensure responsive behavior works across all breakpoints
5. Verify keyboard navigation remains functional

## License

Part of the Rover Mission Control system - proprietary software.