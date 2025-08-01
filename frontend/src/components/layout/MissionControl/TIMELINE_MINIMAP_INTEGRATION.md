# Timeline and MiniMap Integration Guide

## Overview

This document provides comprehensive integration guidance for the Timeline and MiniMap components within the Mission Control Center layout. These components work together to provide temporal and spatial navigation capabilities for rover mission data.

## Component Architecture

### Timeline Component (`Timeline.tsx`)

The Timeline component provides interactive temporal navigation with the following key features:

- **Event Visualization**: Display mission events with type-based coloring and severity indicators
- **Playback Controls**: Play/pause, speed control, and seeking capabilities
- **Bookmarking**: User-defined temporal bookmarks for quick navigation
- **Filtering**: Advanced filtering by event type, category, severity, and text search
- **Export**: Data export in JSON, CSV, and PDF formats
- **Zoom & Pan**: Interactive timeline navigation with viewport controls

### MiniMap Component (`MiniMap.tsx`)

The MiniMap component provides spatial navigation and overview with:

- **Multiple View Modes**: Satellite, terrain, and grid view options
- **Interactive Navigation**: Pan, zoom, and click-to-navigate functionality
- **Rover Tracking**: Real-time rover position and heading display
- **Path Visualization**: Historical path and real-time trail rendering
- **Points of Interest**: Interactive POI management with tooltips
- **Layer Management**: Toggle visibility and opacity of map layers

## Integration Patterns

### 1. Synchronized Timeline-MiniMap Navigation

Implement synchronized navigation where timeline events correspond to spatial locations:

```typescript
import { Timeline, MiniMap } from './components/layout/MissionControl';

const MissionControlCenter: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [roverPosition, setRoverPosition] = useState({ x: 0, y: 0 });
  
  // Synchronize position with timeline
  const handleTimeChange = useCallback((timestamp: number) => {
    setCurrentTime(timestamp);
    
    // Update rover position based on timestamp
    const pathPoint = findPathPointAtTime(path, timestamp);
    if (pathPoint) {
      setRoverPosition(pathPoint.position);
    }
  }, [path]);

  // Synchronize timeline with spatial clicks
  const handleMapClick = useCallback((position: Position) => {
    const nearestEvent = findNearestEventAtPosition(events, position);
    if (nearestEvent) {
      setCurrentTime(nearestEvent.timestamp);
    }
  }, [events]);

  return (
    <div className="mission-control-layout">
      <Timeline
        events={events}
        currentTime={currentTime}
        onTimeChange={handleTimeChange}
        onEventClick={(event) => {
          // Jump to event location on map
          const eventPosition = getEventPosition(event);
          if (eventPosition) {
            setRoverPosition(eventPosition);
          }
        }}
      />
      
      <MiniMap
        roverPosition={roverPosition}
        path={path}
        onMapClick={handleMapClick}
        onPOIClick={(poi) => {
          // Jump to POI timestamp if available
          if (poi.timestamp) {
            setCurrentTime(poi.timestamp);
          }
        }}
      />
    </div>
  );
};
```

### 2. Event-POI Correlation

Link timeline events with spatial points of interest:

```typescript
const correlateEventsWithPOIs = (
  events: TimelineEvent[],
  pois: PointOfInterest[]
): CorrelatedData[] => {
  return events.map(event => {
    const nearbyPOIs = pois.filter(poi => 
      isWithinRadius(event.location, poi.position, 10) // 10m radius
    );
    
    return {
      event,
      relatedPOIs: nearbyPOIs,
      spatialContext: calculateSpatialContext(event, nearbyPOIs)
    };
  });
};
```

### 3. Shared State Management

Use a unified state management approach for both components:

```typescript
interface MissionControlState {
  temporal: {
    currentTime: number;
    timeRange: TimelineRange;
    playbackSpeed: number;
    isPlaying: boolean;
  };
  spatial: {
    viewport: MiniMapViewport;
    roverPosition: Position;
    selectedPOI?: PointOfInterest;
  };
  data: {
    events: TimelineEvent[];
    path: PathPoint[];
    pointsOfInterest: PointOfInterest[];
    bookmarks: TimelineBookmark[];
  };
}

const useMissionControlState = () => {
  const [state, setState] = useState<MissionControlState>(initialState);
  
  const updateTime = useCallback((time: number) => {
    setState(prev => ({
      ...prev,
      temporal: { ...prev.temporal, currentTime: time },
      spatial: { 
        ...prev.spatial, 
        roverPosition: interpolatePositionAtTime(prev.data.path, time)
      }
    }));
  }, []);

  return { state, updateTime, /* other actions */ };
};
```

## Data Flow Patterns

### 1. Event-Driven Updates

```typescript
// Timeline event triggers spatial update
const onTimelineEventClick = (event: TimelineEvent) => {
  // Update minimap viewport to show event location
  setMiniMapViewport({
    center: event.location,
    zoom: 2, // Zoom in to show details
    rotation: 0,
    bounds: calculateBounds(event.location, 50) // 50m radius
  });
  
  // Highlight related POIs
  setHighlightedPOIs(event.relatedPOIIds || []);
};

// Spatial interaction triggers timeline update
const onMiniMapPOIClick = (poi: PointOfInterest) => {
  if (poi.timestamp) {
    // Jump timeline to POI timestamp
    setCurrentTime(poi.timestamp);
    
    // Filter timeline to show related events
    setTimelineFilter({
      ...currentFilter,
      spatialProximity: {
        center: poi.position,
        radius: 25 // 25m radius
      }
    });
  }
};
```

### 2. Real-time Data Synchronization

```typescript
const useRealTimeSync = () => {
  const webSocket = useWebSocket('/api/rover/telemetry');
  
  useEffect(() => {
    webSocket.onMessage((data) => {
      const telemetryUpdate = JSON.parse(data);
      
      // Update timeline with new events
      if (telemetryUpdate.events) {
        addTimelineEvents(telemetryUpdate.events);
      }
      
      // Update minimap with new position
      if (telemetryUpdate.position) {
        updateRoverPosition(telemetryUpdate.position);
        addPathPoint({
          position: telemetryUpdate.position,
          timestamp: Date.now(),
          heading: telemetryUpdate.heading,
          speed: telemetryUpdate.speed
        });
      }
    });
  }, [webSocket]);
};
```

## Layout Integration

### Grid Layout Integration

```css
.mission-control-grid {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main-viz minimap"
    "sidebar timeline minimap"
    "footer footer footer";
  grid-template-columns: 250px 2fr 1fr;
  grid-template-rows: 60px 2fr 200px 60px;
  gap: 8px;
  height: 100vh;
}

.timeline-area {
  grid-area: timeline;
  min-height: 150px;
}

.minimap-area {
  grid-area: minimap;
  min-width: 300px;
}

/* Responsive behavior */
@media (max-width: 1200px) {
  .mission-control-grid {
    grid-template-areas:
      "header header"
      "main-viz minimap"
      "timeline timeline"
      "footer footer";
    grid-template-columns: 2fr 1fr;
    grid-template-rows: 60px 2fr 200px 60px;
  }
}

@media (max-width: 768px) {
  .mission-control-grid {
    grid-template-areas:
      "header"
      "main-viz"
      "timeline"
      "minimap"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: 60px 1fr 150px 200px 60px;
  }
}
```

### Panel Integration with Mission Control Layout

```typescript
// Integration with existing MissionControlLayout
const layoutConfig: LayoutConfiguration = {
  id: 'operations',
  name: 'Operations',
  description: 'Standard layout with timeline and minimap',
  gridTemplate: {
    areas: `
      "header header header header"
      "sidebar main-3d main-3d minimap"
      "sidebar timeline timeline minimap"
      "footer footer footer footer"
    `,
    columns: '280px 1fr 1fr 350px',
    rows: '60px 2fr 200px 60px'
  },
  areas: [
    {
      id: 'timeline',
      name: 'Mission Timeline',
      gridArea: 'timeline',
      defaultPanels: ['timeline-scrubber', 'event-filters'],
      priority: 2
    },
    {
      id: 'minimap',
      name: 'Spatial Overview',
      gridArea: 'minimap',
      defaultPanels: ['rover-minimap', 'poi-manager'],
      priority: 3
    }
  ]
};
```

## Performance Optimization

### 1. Virtualization for Large Datasets

```typescript
// Timeline event virtualization
const VirtualizedTimeline = ({ events, ...props }) => {
  const [visibleEvents, setVisibleEvents] = useState([]);
  
  const updateVisibleEvents = useCallback((viewport: TimelineRange) => {
    const filtered = events.filter(event => 
      event.timestamp >= viewport.start && 
      event.timestamp <= viewport.end
    );
    
    // Limit to viewport + buffer
    const bufferedEvents = filtered.slice(0, 100);
    setVisibleEvents(bufferedEvents);
  }, [events]);

  return (
    <Timeline
      {...props}
      events={visibleEvents}
      onRangeChange={updateVisibleEvents}
    />
  );
};

// MiniMap POI clustering
const ClusteredMiniMap = ({ pointsOfInterest, ...props }) => {
  const clusteredPOIs = useMemo(() => {
    return clusterPOIs(pointsOfInterest, {
      maxZoom: props.viewport?.zoom || 1,
      clusterRadius: 20
    });
  }, [pointsOfInterest, props.viewport?.zoom]);

  return (
    <MiniMap
      {...props}
      pointsOfInterest={clusteredPOIs}
    />
  );
};
```

### 2. Memoization Strategies

```typescript
const OptimizedMissionControl = () => {
  // Memoize expensive calculations
  const processedEvents = useMemo(() => 
    preprocessTimelineEvents(rawEvents), 
    [rawEvents]
  );
  
  const spatialIndex = useMemo(() => 
    buildSpatialIndex(pointsOfInterest), 
    [pointsOfInterest]
  );
  
  // Memoize event handlers
  const handleTimeChange = useCallback((time: number) => {
    updateRoverPosition(interpolatePosition(path, time));
    updateVisiblePOIs(findPOIsNearTime(spatialIndex, time));
  }, [path, spatialIndex]);

  return (
    <MissionControlLayout>
      <Timeline
        events={processedEvents}
        onTimeChange={handleTimeChange}
      />
      <MiniMap
        pointsOfInterest={visiblePOIs}
        onMapClick={handleMapClick}
      />
    </MissionControlLayout>
  );
};
```

## Testing Integration

### Component Integration Tests

```typescript
// Timeline-MiniMap synchronization test
describe('Timeline-MiniMap Integration', () => {
  test('timeline event click updates minimap viewport', async () => {
    const { getByTestId } = render(
      <MissionControlCenter 
        events={mockEvents}
        path={mockPath}
      />
    );

    const timeline = getByTestId('timeline');
    const minimap = getByTestId('minimap');
    
    // Click on timeline event
    const event = screen.getByText('Sample Collection');
    fireEvent.click(event);

    // Verify minimap viewport updated
    await waitFor(() => {
      expect(mockOnViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({
          center: mockEvents[0].location
        })
      );
    });
  });

  test('minimap POI click updates timeline position', async () => {
    // Similar test for reverse synchronization
  });
});
```

### End-to-End Testing

```typescript
// Cypress E2E test
describe('Mission Control Navigation', () => {
  it('provides synchronized timeline-spatial navigation', () => {
    cy.visit('/mission-control');
    
    // Click on timeline event
    cy.get('[data-testid="timeline"]')
      .find('[data-event-id="sample-collection"]')
      .click();
    
    // Verify minimap centered on event location
    cy.get('[data-testid="minimap"]')
      .should('have.attr', 'data-center-x', '25.5')
      .should('have.attr', 'data-center-y', '10.2');
    
    // Click on minimap POI
    cy.get('[data-testid="minimap"]')
      .find('[data-poi-id="hazard-zone-1"]')
      .click();
    
    // Verify timeline jumped to POI timestamp
    cy.get('[data-testid="timeline"]')
      .should('have.attr', 'data-current-time', '1698765432000');
  });
});
```

## Accessibility Considerations

### Keyboard Navigation

```typescript
const useKeyboardIntegration = () => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          if (event.ctrlKey) {
            // Jump to previous timeline event
            jumpToPreviousEvent();
          }
          break;
        case 'ArrowRight':
          if (event.ctrlKey) {
            // Jump to next timeline event
            jumpToNextEvent();
          }
          break;
        case 'Space':
          if (event.ctrlKey) {
            // Toggle timeline playback
            togglePlayback();
          }
          break;
        case 'Enter':
          if (selectedPOI) {
            // Jump timeline to POI timestamp
            jumpToPOITime(selectedPOI);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedPOI]);
};
```

### Screen Reader Support

```typescript
const AccessibleIntegration = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  
  const announceTimelineChange = useCallback((time: number, event?: TimelineEvent) => {
    const timeStr = new Date(time).toLocaleTimeString();
    const message = event 
      ? `Timeline moved to ${timeStr}, ${event.type} event: ${event.title}`
      : `Timeline moved to ${timeStr}`;
    
    setAnnouncements(prev => [...prev, message]);
  }, []);

  const announceSpatialChange = useCallback((position: Position, poi?: PointOfInterest) => {
    const posStr = `${position.x.toFixed(1)}, ${position.y.toFixed(1)}`;
    const message = poi
      ? `Map centered on ${poi.label} at coordinates ${posStr}`
      : `Map centered on coordinates ${posStr}`;
    
    setAnnouncements(prev => [...prev, message]);
  }, []);

  return (
    <div>
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </div>
      
      {/* Components with proper ARIA labels */}
      <Timeline
        aria-label="Mission timeline with events and playback controls"
        onTimeChange={announceTimelineChange}
      />
      <MiniMap
        aria-label="Spatial map showing rover position and points of interest"
        onViewportChange={(viewport) => announceSpatialChange(viewport.center)}
      />
    </div>
  );
};
```

## Best Practices

### 1. State Management
- Use a unified state management solution (Redux, Zustand, or Context)
- Separate concerns: temporal state, spatial state, and UI state
- Implement optimistic updates for better user experience

### 2. Performance
- Implement virtualization for large datasets
- Use memoization for expensive calculations
- Debounce user interactions to prevent excessive updates

### 3. User Experience
- Provide visual feedback for all interactions
- Implement smooth transitions between states
- Support both mouse and keyboard navigation

### 4. Data Synchronization
- Establish clear data flow patterns
- Handle edge cases (missing data, network failures)
- Implement proper error boundaries

### 5. Testing
- Write comprehensive unit tests for individual components
- Create integration tests for component interactions
- Implement E2E tests for complete user workflows

This integration guide ensures that the Timeline and MiniMap components work seamlessly together to provide a comprehensive mission control experience with both temporal and spatial navigation capabilities.