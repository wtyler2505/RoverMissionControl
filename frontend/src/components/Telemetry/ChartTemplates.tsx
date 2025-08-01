import React from 'react';
import {
  Thermostat,
  BatteryFull,
  Speed,
  Navigation,
  Memory,
  SignalCellularAlt,
  WaterDrop,
  Air,
  Lightbulb,
  Science,
  ElectricBolt,
  DeviceThermostat,
  LocalFireDepartment,
  AcUnit,
  WbSunny,
  Vibration,
  Straighten,
  RotateRight,
  MyLocation,
  Explore,
  Height,
  SpeedOutlined,
} from '@mui/icons-material';
import { YAxis, ChartOptions } from './RealTimeChart';

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'thermal' | 'power' | 'motion' | 'environmental' | 'system' | 'communication' | 'scientific';
  recommendedStreams: string[];
  yAxes: YAxis[];
  chartOptions: Partial<ChartOptions>;
  dataProcessing?: {
    aggregation?: 'average' | 'sum' | 'min' | 'max' | 'last';
    decimation?: number;
    smoothing?: boolean;
    transform?: (value: number) => number;
  };
  thresholds?: Array<{
    value: number;
    color: string;
    label: string;
    type: 'warning' | 'critical' | 'info';
  }>;
}

export const chartTemplates: ChartTemplate[] = [
  // Thermal Templates
  {
    id: 'temperature-monitoring',
    name: 'Temperature Monitoring',
    description: 'Monitor temperature sensors with automatic unit conversion and thermal zones',
    icon: <Thermostat />,
    category: 'thermal',
    recommendedStreams: ['temperature', 'temp', 'thermal'],
    yAxes: [
      {
        id: 'celsius',
        label: 'Temperature (°C)',
        position: 'left',
        min: -40,
        max: 100,
        autoScale: true,
        color: '#ff6b6b',
      },
      {
        id: 'fahrenheit',
        label: 'Temperature (°F)',
        position: 'right',
        min: -40,
        max: 212,
        autoScale: true,
        color: '#4ecdc4',
      },
    ],
    chartOptions: {
      timeWindow: 300000, // 5 minutes
      gridColor: 'rgba(255, 255, 255, 0.1)',
      backgroundColor: '#1a1a1a',
      showGrid: true,
      showLabels: true,
      smoothing: true,
      maxDataPoints: 600,
    },
    thresholds: [
      { value: 0, color: '#4ecdc4', label: 'Freezing', type: 'info' },
      { value: 50, color: '#ffa500', label: 'Warning', type: 'warning' },
      { value: 80, color: '#ff4444', label: 'Critical', type: 'critical' },
    ],
  },
  {
    id: 'thermal-zones',
    name: 'Thermal Zone Analysis',
    description: 'Compare multiple temperature zones with heat map visualization',
    icon: <DeviceThermostat />,
    category: 'thermal',
    recommendedStreams: ['zone_temp', 'ambient_temp', 'core_temp'],
    yAxes: [
      {
        id: 'temperature',
        label: 'Temperature (°C)',
        position: 'left',
        autoScale: true,
        color: '#ff6b6b',
      },
    ],
    chartOptions: {
      timeWindow: 600000, // 10 minutes
      backgroundColor: '#0a0a0a',
      showGrid: true,
      enableZoom: true,
      enablePan: true,
    },
  },

  // Power Templates
  {
    id: 'battery-management',
    name: 'Battery Management',
    description: 'Comprehensive battery monitoring with voltage, current, and state of charge',
    icon: <BatteryFull />,
    category: 'power',
    recommendedStreams: ['battery_voltage', 'battery_current', 'battery_soc'],
    yAxes: [
      {
        id: 'voltage',
        label: 'Voltage (V)',
        position: 'left',
        min: 0,
        max: 30,
        autoScale: true,
        color: '#4ecdc4',
      },
      {
        id: 'current',
        label: 'Current (A)',
        position: 'right',
        autoScale: true,
        color: '#ffa500',
      },
    ],
    chartOptions: {
      timeWindow: 600000, // 10 minutes
      showGrid: true,
      smoothing: false,
      updateInterval: 1000,
    },
    thresholds: [
      { value: 10.5, color: '#ff4444', label: 'Low Battery', type: 'critical' },
      { value: 11.5, color: '#ffa500', label: 'Warning', type: 'warning' },
      { value: 13.8, color: '#44ff44', label: 'Fully Charged', type: 'info' },
    ],
  },
  {
    id: 'power-consumption',
    name: 'Power Consumption',
    description: 'Track power usage across different systems',
    icon: <ElectricBolt />,
    category: 'power',
    recommendedStreams: ['power_total', 'power_motor', 'power_compute'],
    yAxes: [
      {
        id: 'power',
        label: 'Power (W)',
        position: 'left',
        min: 0,
        autoScale: true,
        color: '#ff9800',
      },
    ],
    chartOptions: {
      timeWindow: 300000,
      showGrid: true,
      smoothing: true,
      maxDataPoints: 300,
    },
    dataProcessing: {
      aggregation: 'average',
      decimation: 2,
    },
  },

  // Motion Templates
  {
    id: 'position-tracking',
    name: 'Position Tracking',
    description: 'Track X, Y, Z coordinates with trajectory visualization',
    icon: <Navigation />,
    category: 'motion',
    recommendedStreams: ['position_x', 'position_y', 'position_z'],
    yAxes: [
      {
        id: 'position',
        label: 'Position (m)',
        position: 'left',
        autoScale: true,
        color: '#2196f3',
      },
    ],
    chartOptions: {
      timeWindow: 60000,
      showGrid: true,
      enableZoom: true,
      enablePan: true,
    },
  },
  {
    id: 'velocity-analysis',
    name: 'Velocity Analysis',
    description: 'Monitor linear and angular velocities',
    icon: <Speed />,
    category: 'motion',
    recommendedStreams: ['velocity_linear', 'velocity_angular'],
    yAxes: [
      {
        id: 'linear',
        label: 'Linear Velocity (m/s)',
        position: 'left',
        autoScale: true,
        color: '#4caf50',
      },
      {
        id: 'angular',
        label: 'Angular Velocity (rad/s)',
        position: 'right',
        autoScale: true,
        color: '#ff5722',
      },
    ],
    chartOptions: {
      timeWindow: 30000,
      showGrid: true,
      smoothing: true,
      updateInterval: 100,
    },
  },
  {
    id: 'acceleration-monitoring',
    name: 'Acceleration Monitoring',
    description: 'Track acceleration in all axes with G-force conversion',
    icon: <SpeedOutlined />,
    category: 'motion',
    recommendedStreams: ['accel_x', 'accel_y', 'accel_z'],
    yAxes: [
      {
        id: 'acceleration',
        label: 'Acceleration (m/s²)',
        position: 'left',
        autoScale: true,
        color: '#e91e63',
      },
      {
        id: 'gforce',
        label: 'G-Force',
        position: 'right',
        autoScale: true,
        color: '#9c27b0',
      },
    ],
    chartOptions: {
      timeWindow: 10000,
      showGrid: true,
      smoothing: false,
      maxDataPoints: 1000,
      updateInterval: 50,
    },
    dataProcessing: {
      transform: (value: number) => value / 9.81, // Convert to G-force for right axis
    },
  },
  {
    id: 'orientation-tracking',
    name: 'Orientation Tracking',
    description: 'Monitor roll, pitch, and yaw angles',
    icon: <RotateRight />,
    category: 'motion',
    recommendedStreams: ['orientation_roll', 'orientation_pitch', 'orientation_yaw'],
    yAxes: [
      {
        id: 'angles',
        label: 'Angle (degrees)',
        position: 'left',
        min: -180,
        max: 180,
        autoScale: false,
        color: '#3f51b5',
      },
    ],
    chartOptions: {
      timeWindow: 60000,
      showGrid: true,
      smoothing: true,
    },
  },

  // Environmental Templates
  {
    id: 'environmental-monitoring',
    name: 'Environmental Monitoring',
    description: 'Track humidity, pressure, and air quality',
    icon: <Air />,
    category: 'environmental',
    recommendedStreams: ['humidity', 'pressure', 'air_quality'],
    yAxes: [
      {
        id: 'humidity',
        label: 'Humidity (%)',
        position: 'left',
        min: 0,
        max: 100,
        autoScale: false,
        color: '#00bcd4',
      },
      {
        id: 'pressure',
        label: 'Pressure (hPa)',
        position: 'right',
        autoScale: true,
        color: '#795548',
      },
    ],
    chartOptions: {
      timeWindow: 1800000, // 30 minutes
      showGrid: true,
      smoothing: true,
    },
  },
  {
    id: 'light-sensing',
    name: 'Light Sensing',
    description: 'Monitor ambient light levels and UV exposure',
    icon: <WbSunny />,
    category: 'environmental',
    recommendedStreams: ['light_ambient', 'light_uv', 'light_ir'],
    yAxes: [
      {
        id: 'light',
        label: 'Light Intensity (lux)',
        position: 'left',
        min: 0,
        autoScale: true,
        color: '#ffeb3b',
      },
      {
        id: 'uv',
        label: 'UV Index',
        position: 'right',
        min: 0,
        max: 12,
        autoScale: false,
        color: '#673ab7',
      },
    ],
    chartOptions: {
      timeWindow: 3600000, // 1 hour
      backgroundColor: '#0a0a0a',
      showGrid: true,
    },
  },

  // System Templates
  {
    id: 'system-performance',
    name: 'System Performance',
    description: 'Monitor CPU, memory, and disk usage',
    icon: <Memory />,
    category: 'system',
    recommendedStreams: ['cpu_usage', 'memory_usage', 'disk_usage'],
    yAxes: [
      {
        id: 'percentage',
        label: 'Usage (%)',
        position: 'left',
        min: 0,
        max: 100,
        autoScale: false,
        color: '#00e676',
      },
    ],
    chartOptions: {
      timeWindow: 300000,
      showGrid: true,
      smoothing: false,
      updateInterval: 1000,
    },
    thresholds: [
      { value: 80, color: '#ffa500', label: 'High Usage', type: 'warning' },
      { value: 95, color: '#ff4444', label: 'Critical', type: 'critical' },
    ],
  },
  {
    id: 'network-latency',
    name: 'Network Latency',
    description: 'Track network latency and packet loss',
    icon: <SignalCellularAlt />,
    category: 'communication',
    recommendedStreams: ['network_latency', 'packet_loss', 'signal_strength'],
    yAxes: [
      {
        id: 'latency',
        label: 'Latency (ms)',
        position: 'left',
        min: 0,
        autoScale: true,
        color: '#2196f3',
      },
      {
        id: 'loss',
        label: 'Packet Loss (%)',
        position: 'right',
        min: 0,
        max: 100,
        autoScale: false,
        color: '#f44336',
      },
    ],
    chartOptions: {
      timeWindow: 60000,
      showGrid: true,
      smoothing: false,
      updateInterval: 500,
    },
  },

  // Scientific Templates
  {
    id: 'scientific-measurements',
    name: 'Scientific Measurements',
    description: 'General purpose scientific data visualization',
    icon: <Science />,
    category: 'scientific',
    recommendedStreams: ['measurement_1', 'measurement_2', 'measurement_3'],
    yAxes: [
      {
        id: 'primary',
        label: 'Primary Measurement',
        position: 'left',
        autoScale: true,
        color: '#4caf50',
      },
      {
        id: 'secondary',
        label: 'Secondary Measurement',
        position: 'right',
        autoScale: true,
        color: '#ff9800',
      },
    ],
    chartOptions: {
      timeWindow: 300000,
      showGrid: true,
      enableZoom: true,
      enablePan: true,
      smoothing: false,
    },
    dataProcessing: {
      aggregation: 'average',
      decimation: 1,
    },
  },
  {
    id: 'vibration-analysis',
    name: 'Vibration Analysis',
    description: 'Monitor vibration frequencies and amplitudes',
    icon: <Vibration />,
    category: 'scientific',
    recommendedStreams: ['vibration_x', 'vibration_y', 'vibration_z'],
    yAxes: [
      {
        id: 'amplitude',
        label: 'Amplitude (mm/s)',
        position: 'left',
        autoScale: true,
        color: '#e91e63',
      },
    ],
    chartOptions: {
      timeWindow: 10000,
      showGrid: true,
      smoothing: false,
      maxDataPoints: 2000,
      updateInterval: 50,
    },
  },
];

// Helper function to get templates by category
export const getTemplatesByCategory = (category: ChartTemplate['category']): ChartTemplate[] => {
  return chartTemplates.filter(template => template.category === category);
};

// Helper function to get template by ID
export const getTemplateById = (id: string): ChartTemplate | undefined => {
  return chartTemplates.find(template => template.id === id);
};

// Helper function to get recommended template for stream names
export const getRecommendedTemplate = (streamNames: string[]): ChartTemplate | undefined => {
  // Score each template based on how many recommended streams match
  let bestTemplate: ChartTemplate | undefined;
  let bestScore = 0;

  chartTemplates.forEach(template => {
    let score = 0;
    streamNames.forEach(streamName => {
      const lowerStreamName = streamName.toLowerCase();
      template.recommendedStreams.forEach(recommended => {
        if (lowerStreamName.includes(recommended.toLowerCase())) {
          score++;
        }
      });
    });

    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  });

  return bestTemplate;
};

// Helper function to apply template to chart configuration
export const applyTemplate = (
  template: ChartTemplate,
  streamIds: string[]
): {
  yAxes: YAxis[];
  chartOptions: Partial<ChartOptions>;
  dataProcessing?: ChartTemplate['dataProcessing'];
  thresholds?: ChartTemplate['thresholds'];
} => {
  // Clone the template configuration
  const yAxes = template.yAxes.map(axis => ({ ...axis }));
  const chartOptions = { ...template.chartOptions };
  
  // Adjust based on number of streams
  if (streamIds.length === 1 && yAxes.length > 1) {
    // If only one stream but multiple axes, use only the first axis
    yAxes.splice(1);
  }

  return {
    yAxes,
    chartOptions,
    dataProcessing: template.dataProcessing,
    thresholds: template.thresholds,
  };
};

// Export individual template categories for easier access
export const thermalTemplates = getTemplatesByCategory('thermal');
export const powerTemplates = getTemplatesByCategory('power');
export const motionTemplates = getTemplatesByCategory('motion');
export const environmentalTemplates = getTemplatesByCategory('environmental');
export const systemTemplates = getTemplatesByCategory('system');
export const communicationTemplates = getTemplatesByCategory('communication');
export const scientificTemplates = getTemplatesByCategory('scientific');

// Template validation
export const validateTemplate = (template: ChartTemplate): string[] => {
  const errors: string[] = [];

  if (!template.id) errors.push('Template ID is required');
  if (!template.name) errors.push('Template name is required');
  if (!template.category) errors.push('Template category is required');
  if (!template.yAxes || template.yAxes.length === 0) errors.push('At least one Y-axis is required');
  
  // Check for duplicate axis IDs
  const axisIds = new Set<string>();
  template.yAxes.forEach(axis => {
    if (axisIds.has(axis.id)) {
      errors.push(`Duplicate axis ID: ${axis.id}`);
    }
    axisIds.add(axis.id);
  });

  // Validate thresholds
  if (template.thresholds) {
    template.thresholds.forEach((threshold, index) => {
      if (threshold.value === undefined) {
        errors.push(`Threshold ${index} is missing a value`);
      }
    });
  }

  return errors;
};

export default chartTemplates;