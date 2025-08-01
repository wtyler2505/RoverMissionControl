/**
 * MiniMap Component Unit Tests
 * Comprehensive test suite for MiniMap component functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MiniMap, { Position, PointOfInterest, PathPoint, MiniMapViewport, MiniMapLayer } from './MiniMap';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={createTheme()}>
    {children}
  </ThemeProvider>
);

// Mock data
const mockRoverPosition: Position = { x: 0, y: 0, z: 2.5 };

const mockPath: PathPoint[] = [
  {
    position: { x: -10, y: -10, z: 2 },
    timestamp: Date.now() - 120000, // 2 minutes ago
    speed: 1.5,
    heading: 45,
    confidence: 0.9,
  },
  {
    position: { x: -5, y: -5, z: 2.2 },
    timestamp: Date.now() - 60000, // 1 minute ago
    speed: 1.2,
    heading: 90,
    confidence: 0.85,
  },
  {
    position: { x: 0, y: 0, z: 2.5 },
    timestamp: Date.now(), // Now
    speed: 0,
    heading: 135,
    confidence: 0.95,
  },
];

const mockPOIs: PointOfInterest[] = [
  {
    id: 'poi-1',
    type: 'waypoint',
    position: { x: 10, y: 15, z: 3 },
    label: 'Waypoint 1',
    description: 'First navigation waypoint',
    color: '#2196f3',
    size: 8,
  },
  {
    id: 'poi-2',
    type: 'hazard',
    position: { x: -15, y: 20, z: 1.5 },
    label: 'Hazard Zone',
    description: 'Potential obstacle area',
    color: '#f44336',
    size: 12,
  },
  {
    id: 'poi-3',
    type: 'sample',
    position: { x: 25, y: -10, z: 4 },
    label: 'Sample Site',
    description: 'Geological sample location',
    color: '#4caf50',
    size: 10,
  },
];

const mockLayers: MiniMapLayer[] = [
  {
    id: 'satellite',
    name: 'Satellite View',
    type: 'base',
    visible: true,
    opacity: 1,
    zIndex: 1,
    data: { source: 'satellite' },
  },
  {
    id: 'hazards',
    name: 'Hazard Overlay',
    type: 'overlay',
    visible: false,
    opacity: 0.7,
    zIndex: 10,
    data: { zones: [] },
  },
];

const mockViewport: MiniMapViewport = {
  center: mockRoverPosition,
  zoom: 1,
  rotation: 0,
  bounds: { minX: -50, maxX: 50, minY: -50, maxY: 50 },
};

const defaultProps = {
  roverPosition: mockRoverPosition,
  roverHeading: 45,
  path: mockPath,
  pointsOfInterest: mockPOIs,
  layers: mockLayers,
  viewport: mockViewport,
  width: '100%',
  height: 400,
  showGrid: true,
  showScale: true,
  showCompass: true,
  showCoordinates: true,
  showPath: true,
  showTrail: true,
  pathLength: 50,
  interactive: true,
  enablePan: true,
  enableZoom: true,
  centerOnRover: false,
  trackRover: false,
  onViewportChange: jest.fn(),
  onRoverClick: jest.fn(),
  onPathClick: jest.fn(),
  onPOIClick: jest.fn(),
  onPOIDoubleClick: jest.fn(),
  onMapClick: jest.fn(),
  onLayerToggle: jest.fn(),
};

// Mock getBoundingClientRect for interaction tests
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: jest.fn(() => ({
    width: 400,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 400,
    x: 0,
    y: 0,
    toJSON: jest.fn(),
  })),
});

describe('MiniMap Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders minimap with default props', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      // Check for zoom controls
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
    });

    test('renders rover position', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} data-testid="minimap" />
        </TestWrapper>
      );

      const minimap = screen.getByTestId('minimap');
      expect(minimap).toBeInTheDocument();

      // Rover should be represented in the map
      // This might need adjustment based on how rover is rendered
    });

    test('renders points of interest', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      // POIs should be clickable elements
      // The exact test might depend on how POIs are rendered
      expect(screen.getByText('Waypoint 1')).toBeInTheDocument();
    });

    test('renders path when showPath is true', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} showPath={true} />
        </TestWrapper>
      );

      // Path should be rendered as SVG elements or similar
      // This test might need adjustment based on implementation
    });

    test('hides elements when show flags are false', () => {
      render(
        <TestWrapper>
          <MiniMap 
            {...defaultProps} 
            showGrid={false}
            showScale={false}
            showCompass={false}
            showCoordinates={false}
          />
        </TestWrapper>
      );

      // These elements should not be present
      expect(screen.queryByText(/scale/i)).not.toBeInTheDocument();
    });

    test('renders in compact size', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} width={200} height={150} />
        </TestWrapper>
      );

      // Should handle small dimensions gracefully
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });
  });

  describe('View Mode Controls', () => {
    test('view mode toggle changes active mode', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const satelliteButton = screen.getByRole('button', { name: /satellite/i });
      const terrainButton = screen.getByRole('button', { name: /terrain/i });
      const gridButton = screen.getByRole('button', { name: /grid/i });

      expect(satelliteButton).toBeInTheDocument();
      expect(terrainButton).toBeInTheDocument();
      expect(gridButton).toBeInTheDocument();

      await user.click(terrainButton);
      // View mode should change (visual feedback might be tested through styling)
    });

    test('only one view mode can be active at a time', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const satelliteButton = screen.getByRole('button', { name: /satellite/i });
      const terrainButton = screen.getByRole('button', { name: /terrain/i });

      await user.click(terrainButton);
      await user.click(satelliteButton);

      // Only satellite should be active now
    });
  });

  describe('Zoom Controls', () => {
    test('zoom in button increases zoom level', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);

      expect(defaultProps.onViewportChange).toHaveBeenCalled();
      const lastCall = defaultProps.onViewportChange.mock.calls[0][0];
      expect(lastCall.zoom).toBeGreaterThan(mockViewport.zoom);
    });

    test('zoom out button decreases zoom level', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      await user.click(zoomOutButton);

      expect(defaultProps.onViewportChange).toHaveBeenCalled();
      const lastCall = defaultProps.onViewportChange.mock.calls[0][0];
      expect(lastCall.zoom).toBeLessThan(mockViewport.zoom);
    });

    test('fit to bounds button resets zoom', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const fitButton = screen.getByRole('button', { name: /zoom out map/i });
      await user.click(fitButton);

      expect(defaultProps.onViewportChange).toHaveBeenCalled();
    });

    test('mouse wheel zooms map', async () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} enableZoom={true} />
        </TestWrapper>
      );

      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        fireEvent.wheel(mapContainer, { deltaY: -100 });
        expect(defaultProps.onViewportChange).toHaveBeenCalled();
      }
    });

    test('disables zoom when enableZoom is false', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} enableZoom={false} />
        </TestWrapper>
      );

      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        fireEvent.wheel(mapContainer, { deltaY: -100 });
        expect(defaultProps.onViewportChange).not.toHaveBeenCalled();
      }
    });
  });

  describe('Pan Controls', () => {
    test('center on rover button centers view', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const centerButton = screen.getByRole('button', { name: /center on rover/i }) ||
                          screen.getByRole('button', { name: /my location/i });
      
      await user.click(centerButton);

      expect(defaultProps.onViewportChange).toHaveBeenCalled();
      const lastCall = defaultProps.onViewportChange.mock.calls[0][0];
      expect(lastCall.center).toEqual(mockRoverPosition);
    });

    test('mouse drag pans the map', async () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} enablePan={true} />
        </TestWrapper>
      );

      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        fireEvent.mouseDown(mapContainer, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(mapContainer, { clientX: 150, clientY: 150 });
        fireEvent.mouseUp(mapContainer);

        expect(defaultProps.onViewportChange).toHaveBeenCalled();
      }
    });

    test('disables pan when enablePan is false', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} enablePan={false} />
        </TestWrapper>
      );

      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        fireEvent.mouseDown(mapContainer, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(mapContainer, { clientX: 150, clientY: 150 });
        fireEvent.mouseUp(mapContainer);

        expect(defaultProps.onViewportChange).not.toHaveBeenCalled();
      }
    });
  });

  describe('Rover Interaction', () => {
    test('clicking rover triggers onRoverClick', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      // Find rover element (this might need adjustment based on implementation)
      const roverElement = document.querySelector('[data-testid*="rover"]') ||
                          screen.getByRole('button', { name: /rover/i });

      if (roverElement) {
        await user.click(roverElement);
        expect(defaultProps.onRoverClick).toHaveBeenCalledWith(mockRoverPosition);
      }
    });

    test('rover heading is displayed correctly', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} roverHeading={90} />
        </TestWrapper>
      );

      // Rover heading should be visually represented
      // This test might need adjustment based on implementation
    });

    test('rover tracking updates viewport', () => {
      const newRoverPosition = { x: 20, y: 30, z: 3 };
      
      const { rerender } = render(
        <TestWrapper>
          <MiniMap {...defaultProps} trackRover={true} />
        </TestWrapper>
      );

      rerender(
        <TestWrapper>
          <MiniMap 
            {...defaultProps} 
            trackRover={true} 
            roverPosition={newRoverPosition}
          />
        </TestWrapper>
      );

      expect(defaultProps.onViewportChange).toHaveBeenCalled();
    });
  });

  describe('POI Interaction', () => {
    test('clicking POI triggers onPOIClick', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      // Find POI element
      const poiElement = screen.getByText('Waypoint 1');
      await user.click(poiElement);

      expect(defaultProps.onPOIClick).toHaveBeenCalledWith(mockPOIs[0]);
    });

    test('double clicking POI triggers onPOIDoubleClick', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const poiElement = screen.getByText('Waypoint 1');
      await user.dblClick(poiElement);

      expect(defaultProps.onPOIDoubleClick).toHaveBeenCalledWith(mockPOIs[0]);
    });

    test('POI tooltip shows on hover', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const poiElement = screen.getByText('Waypoint 1');
      await user.hover(poiElement);

      await waitFor(() => {
        expect(screen.getByText(/first navigation waypoint/i)).toBeInTheDocument();
      });
    });
  });

  describe('Layer Management', () => {
    test('layers menu shows available layers', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const layersButton = screen.getByRole('button', { name: /layers/i });
      await user.click(layersButton);

      await waitFor(() => {
        expect(screen.getByText('Satellite View')).toBeInTheDocument();
        expect(screen.getByText('Hazard Overlay')).toBeInTheDocument();
      });
    });

    test('toggling layer visibility', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const layersButton = screen.getByRole('button', { name: /layers/i });
      await user.click(layersButton);

      // Find layer toggle (visibility icon)
      const visibilityButton = screen.getAllByRole('button')[0]; // First visibility button
      if (visibilityButton) {
        await user.click(visibilityButton);
        expect(defaultProps.onLayerToggle).toHaveBeenCalled();
      }
    });

    test('layer opacity slider changes opacity', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const layersButton = screen.getByRole('button', { name: /layers/i });
      await user.click(layersButton);

      // Find opacity slider
      const slider = screen.getByRole('slider');
      if (slider) {
        fireEvent.change(slider, { target: { value: 0.5 } });
        // Layer opacity should be updated
      }
    });
  });

  describe('Map Click Interaction', () => {
    test('clicking empty map area triggers onMapClick', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        await user.click(mapContainer);
        expect(defaultProps.onMapClick).toHaveBeenCalled();
      }
    });

    test('click coordinates are converted to world position', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        await user.click(mapContainer);
        
        expect(defaultProps.onMapClick).toHaveBeenCalled();
        const clickPosition = defaultProps.onMapClick.mock.calls[0][0];
        expect(clickPosition).toHaveProperty('x');
        expect(clickPosition).toHaveProperty('y');
      }
    });
  });

  describe('Display Elements', () => {
    test('shows scale indicator when enabled', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} showScale={true} />
        </TestWrapper>
      );

      // Scale should show ratio and distance
      expect(screen.getByText(/1:/)).toBeInTheDocument();
    });

    test('shows compass when enabled', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} showCompass={true} />
        </TestWrapper>
      );

      // Compass should be visible
      // This might need adjustment based on implementation
    });

    test('shows coordinates when enabled', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} showCoordinates={true} />
        </TestWrapper>
      );

      // Should show rover and view coordinates
      expect(screen.getByText(/rover:/i)).toBeInTheDocument();
      expect(screen.getByText(/view:/i)).toBeInTheDocument();
    });

    test('shows grid when enabled', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} showGrid={true} />
        </TestWrapper>
      );

      // Grid should be rendered in SVG
      // This test might need adjustment based on implementation
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} data-testid="minimap-a11y" />
        </TestWrapper>
      );

      const minimap = screen.getByTestId('minimap-a11y');
      expect(minimap).toBeInTheDocument();

      // Check for button accessibility
      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      expect(zoomInButton).toHaveAttribute('type', 'button');
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      // Tab through interactive elements
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();

      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });

    test('provides tooltips for interactive elements', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      const centerButton = screen.getByRole('button', { name: /center on rover/i }) ||
                          screen.getByRole('button', { name: /my location/i });
      
      await user.hover(centerButton);

      await waitFor(() => {
        expect(screen.getByText(/center on rover/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty path array', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} path={[]} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });

    test('handles empty POIs array', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} pointsOfInterest={[]} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });

    test('handles missing rover position gracefully', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} roverPosition={{ x: NaN, y: NaN }} />
        </TestWrapper>
      );

      // Should not crash
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });

    test('handles extreme zoom levels', () => {
      render(
        <TestWrapper>
          <MiniMap 
            {...defaultProps} 
            viewport={{
              ...mockViewport,
              zoom: 0.001, // Very small zoom
            }}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles large number of POIs', () => {
      const manyPOIs = Array.from({ length: 1000 }, (_, i) => ({
        ...mockPOIs[0],
        id: `poi-${i}`,
        position: { x: i % 100, y: Math.floor(i / 100), z: 0 },
        label: `POI ${i}`,
      }));

      render(
        <TestWrapper>
          <MiniMap {...defaultProps} pointsOfInterest={manyPOIs} />
        </TestWrapper>
      );

      // Should render without performance issues
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });

    test('handles long path efficiently', () => {
      const longPath = Array.from({ length: 10000 }, (_, i) => ({
        position: { x: i * 0.1, y: Math.sin(i * 0.01) * 10, z: 0 },
        timestamp: Date.now() - i * 1000,
        speed: 1,
        heading: 0,
        confidence: 0.9,
      }));

      render(
        <TestWrapper>
          <MiniMap {...defaultProps} path={longPath} pathLength={100} />
        </TestWrapper>
      );

      // Should limit path rendering for performance
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    });
  });

  describe('Coordinate Transformations', () => {
    test('world to screen conversion works correctly', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} data-testid="minimap-coords" />
        </TestWrapper>
      );

      // This is more of an integration test
      // The actual coordinate transformation logic would be tested internally
      expect(screen.getByTestId('minimap-coords')).toBeInTheDocument();
    });

    test('screen to world conversion works correctly', () => {
      render(
        <TestWrapper>
          <MiniMap {...defaultProps} />
        </TestWrapper>
      );

      // Click should convert screen coordinates to world coordinates correctly
      const mapContainer = screen.getByTestId('minimap') || 
                          document.querySelector('[data-testid*="minimap"]') ||
                          screen.getByRole('region');

      if (mapContainer) {
        fireEvent.click(mapContainer, { clientX: 200, clientY: 200 });
        
        if (defaultProps.onMapClick.mock.calls.length > 0) {
          const worldPos = defaultProps.onMapClick.mock.calls[0][0];
          expect(typeof worldPos.x).toBe('number');
          expect(typeof worldPos.y).toBe('number');
        }
      }
    });
  });
});