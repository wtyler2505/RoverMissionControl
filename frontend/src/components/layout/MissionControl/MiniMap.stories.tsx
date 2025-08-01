/**
 * MiniMap Storybook Stories
 * Interactive documentation and testing for MiniMap component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { within, userEvent, expect } from '@storybook/test';
import { Box, ThemeProvider, createTheme } from '@mui/material';
import MiniMap, { Position, PointOfInterest, PathPoint, MiniMapViewport, MiniMapLayer } from './MiniMap';

// Generate sample path data
const generateSamplePath = (startPos: Position, numPoints: number, timeSpan: number): PathPoint[] => {
  const path: PathPoint[] = [];
  const startTime = Date.now() - timeSpan;
  
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    const angle = progress * Math.PI * 4; // 4 full circles
    const radius = 10 + progress * 20; // Expanding spiral
    
    path.push({
      position: {
        x: startPos.x + Math.cos(angle) * radius,
        y: startPos.y + Math.sin(angle) * radius,
        z: Math.random() * 5, // Random elevation
      },
      timestamp: startTime + progress * timeSpan,
      speed: 0.5 + Math.random() * 2, // 0.5-2.5 m/s
      heading: (angle * 180 / Math.PI) % 360,
      confidence: 0.8 + Math.random() * 0.2,
    });
  }
  
  return path;
};

// Generate sample POIs
const generateSamplePOIs = (center: Position, count: number): PointOfInterest[] => {
  const pois: PointOfInterest[] = [];
  const types = ['waypoint', 'hazard', 'sample', 'landmark', 'target', 'obstacle'] as const;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const distance = 20 + Math.random() * 40;
    const type = types[Math.floor(Math.random() * types.length)];
    
    pois.push({
      id: `poi-${i}`,
      type,
      position: {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
        z: Math.random() * 10,
      },
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}`,
      description: `Sample ${type} point of interest`,
      timestamp: Date.now() - Math.random() * 86400000, // Within last 24 hours
      metadata: {
        priority: Math.floor(Math.random() * 5) + 1,
        status: Math.random() > 0.5 ? 'active' : 'inactive',
      },
    });
  }
  
  return pois;
};

// Generate sample layers
const generateSampleLayers = (): MiniMapLayer[] => [
  {
    id: 'satellite',
    name: 'Satellite Imagery',
    type: 'base',
    visible: true,
    opacity: 1,
    zIndex: 1,
    data: { source: 'satellite' },
  },
  {
    id: 'terrain',
    name: 'Terrain Model',
    type: 'base',
    visible: false,
    opacity: 0.8,
    zIndex: 2,
    data: { source: 'dem' },
  },
  {
    id: 'hazards',
    name: 'Hazard Zones',
    type: 'overlay',
    visible: true,
    opacity: 0.6,
    zIndex: 10,
    data: { zones: [] },
  },
  {
    id: 'coverage',
    name: 'Mission Coverage',
    type: 'data',
    visible: true,
    opacity: 0.4,
    zIndex: 5,
    data: { coverage: 0.75 },
  },
];

const roverPosition: Position = { x: 0, y: 0, z: 2.5 };
const samplePath = generateSamplePath(roverPosition, 50, 2 * 60 * 60 * 1000); // 2 hours
const samplePOIs = generateSamplePOIs(roverPosition, 12);
const sampleLayers = generateSampleLayers();

const defaultViewport: MiniMapViewport = {
  center: roverPosition,
  zoom: 1,
  rotation: 0,
  bounds: { minX: -100, maxX: 100, minY: -100, maxY: 100 },
};

const meta: Meta<typeof MiniMap> = {
  title: 'Mission Control/MiniMap',
  component: MiniMap,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive mini-map for spatial navigation and overview with multiple view modes, layers, and real-time rover tracking.',
      },
    },
  },
  argTypes: {
    roverPosition: {
      description: 'Current rover position',
      control: { type: 'object' },
    },
    roverHeading: {
      description: 'Rover heading in degrees',
      control: { type: 'number', min: 0, max: 360, step: 1 },
    },
    path: {
      description: 'Rover path history',
      control: { type: 'object' },
    },
    pointsOfInterest: {
      description: 'Points of Interest on the map',
      control: { type: 'object' },
    },
    width: {
      description: 'Map width',
      control: { type: 'text' },
    },
    height: {
      description: 'Map height',
      control: { type: 'number', min: 200, max: 800, step: 10 },
    },
    showGrid: {
      description: 'Show coordinate grid',
      control: { type: 'boolean' },
    },
    showScale: {
      description: 'Show scale indicator',
      control: { type: 'boolean' },
    },
    showCompass: {
      description: 'Show compass rose',
      control: { type: 'boolean' },
    },
    showCoordinates: {
      description: 'Show coordinate display',
      control: { type: 'boolean' },
    },
    showPath: {
      description: 'Show rover path',
      control: { type: 'boolean' },
    },
    showTrail: {
      description: 'Show recent trail',
      control: { type: 'boolean' },
    },
    interactive: {
      description: 'Enable map interaction',
      control: { type: 'boolean' },
    },
    enablePan: {
      description: 'Enable panning',
      control: { type: 'boolean' },
    },
    enableZoom: {
      description: 'Enable zooming',
      control: { type: 'boolean' },
    },
    centerOnRover: {
      description: 'Center view on rover',
      control: { type: 'boolean' },
    },
    trackRover: {
      description: 'Track rover automatically',
      control: { type: 'boolean' },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={createTheme()}>
        <Box sx={{ p: 2, backgroundColor: 'background.default', minHeight: '100vh' }}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MiniMap>;

// Default story
export const Default: Story = {
  args: {
    roverPosition,
    roverHeading: 45,
    path: samplePath.slice(-20), // Recent path only
    pointsOfInterest: samplePOIs.slice(0, 6),
    layers: sampleLayers,
    viewport: defaultViewport,
    width: '100%',
    height: 400,
    showGrid: true,
    showScale: true,
    showCompass: true,
    showCoordinates: true,
    showPath: true,
    showTrail: true,
    pathLength: 20,
    interactive: true,
    enablePan: true,
    enableZoom: true,
    enableRotation: false,
    centerOnRover: false,
    trackRover: false,
    onViewportChange: action('onViewportChange'),
    onRoverClick: action('onRoverClick'),
    onPathClick: action('onPathClick'),
    onPOIClick: action('onPOIClick'),
    onPOIDoubleClick: action('onPOIDoubleClick'),
    onMapClick: action('onMapClick'),
    onLayerToggle: action('onLayerToggle'),
  },
};

// Rover tracking mode
export const RoverTracking: Story = {
  args: {
    ...Default.args,
    trackRover: true,
    centerOnRover: true,
    path: samplePath,
    roverPosition: samplePath[samplePath.length - 1]?.position || roverPosition,
    roverHeading: samplePath[samplePath.length - 1]?.heading || 0,
  },
};

// Large map with full path
export const LargeMapFullPath: Story = {
  args: {
    ...Default.args,
    height: 600,
    path: samplePath,
    pointsOfInterest: samplePOIs,
    pathLength: 100,
    viewport: {
      ...defaultViewport,
      zoom: 0.5,
      bounds: { minX: -200, maxX: 200, minY: -200, maxY: 200 },
    },
  },
};

// Compact map
export const CompactMap: Story = {
  args: {
    ...Default.args,
    height: 200,
    width: 300,
    showCoordinates: false,
    showScale: false,
    pointsOfInterest: samplePOIs.slice(0, 3),
    path: samplePath.slice(-10),
  },
};

// Satellite view mode
export const SatelliteView: Story = {
  args: {
    ...Default.args,
    layers: sampleLayers.map(layer => ({
      ...layer,
      visible: layer.id === 'satellite',
    })),
    showGrid: false,
    backgroundColor: '#2c3e50',
  },
};

// Terrain view mode
export const TerrainView: Story = {
  args: {
    ...Default.args,
    layers: sampleLayers.map(layer => ({
      ...layer,
      visible: layer.id === 'terrain' || layer.id === 'hazards',
    })),
    backgroundColor: '#8b4513',
    showGrid: true,
    gridColor: '#654321',
  },
};

// Grid view mode
export const GridView: Story = {
  args: {
    ...Default.args,
    showGrid: true,
    backgroundColor: '#f8f9fa',
    gridColor: '#dee2e6',
    layers: [],
  },
};

// High zoom level
export const HighZoom: Story = {
  args: {
    ...Default.args,
    viewport: {
      ...defaultViewport,
      zoom: 4,
      bounds: { minX: -25, maxX: 25, minY: -25, maxY: 25 },
    },
    path: samplePath.slice(-10),
    pointsOfInterest: samplePOIs.slice(0, 3),
  },
};

// Low zoom level (overview)
export const Overview: Story = {
  args: {
    ...Default.args,
    viewport: {
      ...defaultViewport,
      zoom: 0.2,
      bounds: { minX: -500, maxX: 500, minY: -500, maxY: 500 },
    },
    path: samplePath,
    pointsOfInterest: samplePOIs,
  },
};

// Many POIs
export const ManyPOIs: Story = {
  args: {
    ...Default.args,
    pointsOfInterest: generateSamplePOIs(roverPosition, 30),
    height: 500,
  },
};

// Minimal UI
export const MinimalUI: Story = {
  args: {
    ...Default.args,
    showGrid: false,
    showScale: false,
    showCompass: false,
    showCoordinates: false,
    layers: [],
    pointsOfInterest: [],
    path: samplePath.slice(-5),
    height: 250,
  },
};

// Non-interactive
export const NonInteractive: Story = {
  args: {
    ...Default.args,
    interactive: false,
    enablePan: false,
    enableZoom: false,
    height: 300,
  },
};

// Hazard zones
export const HazardZones: Story = {
  args: {
    ...Default.args,
    pointsOfInterest: samplePOIs.map(poi => ({
      ...poi,
      type: poi.type === 'sample' ? 'hazard' : poi.type,
    })),
    layers: sampleLayers.map(layer => ({
      ...layer,
      visible: layer.id === 'hazards' || layer.id === 'terrain',
    })),
  },
};

// Mission planning view
export const MissionPlanning: Story = {
  args: {
    ...Default.args,
    pointsOfInterest: [
      ...samplePOIs.filter(poi => poi.type === 'waypoint' || poi.type === 'target'),
      {
        id: 'mission-start',
        type: 'landmark',
        position: { x: -40, y: -40 },
        label: 'Mission Start',
        description: 'Initial rover deployment location',
      },
      {
        id: 'mission-end',
        type: 'target',
        position: { x: 60, y: 60 },
        label: 'Mission Target',
        description: 'Primary mission objective location',
      },
    ],
    showPath: false,
    showTrail: false,
    roverHeading: undefined,
  },
};

// Real-time navigation
export const RealTimeNavigation: Story = {
  args: {
    ...Default.args,
    trackRover: true,
    showTrail: true,
    pathLength: 50,
    path: samplePath,
    roverPosition: samplePath[Math.floor(samplePath.length * 0.8)]?.position || roverPosition,
    roverHeading: samplePath[Math.floor(samplePath.length * 0.8)]?.heading || 0,
  },
};

// Emergency mode
export const EmergencyMode: Story = {
  args: {
    ...Default.args,
    pointsOfInterest: [
      {
        id: 'emergency-location',
        type: 'hazard',
        position: { x: 10, y: 15 },
        label: 'Emergency Stop',
        description: 'Rover emergency stop location',
        color: '#d32f2f',
        size: 12,
      },
      {
        id: 'safe-zone',
        type: 'landmark',
        position: { x: -20, y: -10 },
        label: 'Safe Zone',
        description: 'Designated safe area',
        color: '#2e7d32',
        size: 10,
      },
    ],
    roverColor: '#ff5722',
    pathColor: '#d32f2f',
    backgroundColor: '#ffebee',
  },
};

// Interactive tests
export const InteractiveTests: Story = {
  args: {
    ...Default.args,
    'data-testid': 'minimap-interactive',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test map interaction
    const map = canvas.getByTestId('minimap-interactive');
    expect(map).toBeInTheDocument();
    
    // Test zoom controls
    const zoomInButton = canvas.getByRole('button', { name: /zoom in/i });
    if (zoomInButton) {
      await userEvent.click(zoomInButton);
    }
    
    // Test view mode toggle
    const satelliteButton = canvas.getByRole('button', { name: /satellite/i });
    if (satelliteButton) {
      await userEvent.click(satelliteButton);
    }
  },
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    ...Default.args,
    backgroundColor: '#121212',
    gridColor: '#333333',
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <Box sx={{ p: 2, backgroundColor: 'background.default', minHeight: '100vh' }}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
};

// Accessibility test
export const AccessibilityTest: Story = {
  args: {
    ...Default.args,
    'data-testid': 'minimap-accessibility',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test keyboard navigation
    const map = canvas.getByTestId('minimap-accessibility');
    expect(map).toBeInTheDocument();
    
    // Test button accessibility
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Test focus management
    await userEvent.tab();
    expect(document.activeElement).toBeInTheDocument();
  },
};

// Performance test
export const PerformanceTest: Story = {
  args: {
    ...Default.args,
    path: generateSamplePath(roverPosition, 1000, 24 * 60 * 60 * 1000), // 24 hours, 1000 points
    pointsOfInterest: generateSamplePOIs(roverPosition, 100),
    pathLength: 200,
    height: 500,
  },
};

// Custom styling
export const CustomStyling: Story = {
  args: {
    ...Default.args,
    backgroundColor: '#e8f5e8',
    gridColor: '#c8e6c9',
    pathColor: '#1976d2',
    roverColor: '#d32f2f',
    trailColor: '#42a5f5',
    height: 350,
  },
};

// Layer management
export const LayerManagement: Story = {
  args: {
    ...Default.args,
    layers: [
      ...sampleLayers,
      {
        id: 'custom-overlay',
        name: 'Custom Overlay',
        type: 'overlay',
        visible: true,
        opacity: 0.7,
        zIndex: 15,
        data: { custom: true },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test layer menu
    const layersButton = canvas.getByRole('button', { name: /layers/i });
    if (layersButton) {
      await userEvent.click(layersButton);
    }
  },
};