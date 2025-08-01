/**
 * Command Registry for Mission Control
 * Contains all available commands organized by category
 */

import { Command } from './types';

export const NAVIGATION_COMMANDS: Command[] = [
  {
    id: 'move.forward',
    name: 'move forward',
    description: 'Move rover forward by specified distance',
    category: 'navigation',
    syntax: 'move forward <distance> [speed]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'medium',
    executionTime: 'medium',
    parameters: [
      {
        name: 'distance',
        type: 'number',
        description: 'Distance to move in meters',
        required: true,
        min: 0.1,
        max: 100,
        unit: 'm'
      },
      {
        name: 'speed',
        type: 'select',
        description: 'Movement speed',
        required: false,
        default: 'normal',
        options: [
          { value: 'slow', label: 'Slow (0.1 m/s)' },
          { value: 'normal', label: 'Normal (0.5 m/s)' },
          { value: 'fast', label: 'Fast (1.0 m/s)' }
        ]
      }
    ],
    aliases: ['forward', 'go forward', 'move fwd'],
    examples: [
      {
        command: 'move forward 5 slow',
        description: 'Move 5 meters forward at slow speed',
        parameters: { distance: 5, speed: 'slow' }
      }
    ]
  },
  {
    id: 'move.backward',
    name: 'move backward',
    description: 'Move rover backward by specified distance',
    category: 'navigation',
    syntax: 'move backward <distance> [speed]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'medium',
    executionTime: 'medium',
    parameters: [
      {
        name: 'distance',
        type: 'number',
        description: 'Distance to move in meters',
        required: true,
        min: 0.1,
        max: 50,
        unit: 'm'
      },
      {
        name: 'speed',
        type: 'select',
        description: 'Movement speed',
        required: false,
        default: 'slow',
        options: [
          { value: 'slow', label: 'Slow (0.1 m/s)' },
          { value: 'normal', label: 'Normal (0.3 m/s)' }
        ]
      }
    ],
    aliases: ['backward', 'back', 'reverse']
  },
  {
    id: 'turn.left',
    name: 'turn left',
    description: 'Turn rover left by specified angle',
    category: 'navigation',
    syntax: 'turn left <angle>',
    confirmationRequired: false,
    requiresConnection: true,
    dangerLevel: 'low',
    executionTime: 'short',
    parameters: [
      {
        name: 'angle',
        type: 'number',
        description: 'Angle to turn in degrees',
        required: true,
        min: 1,
        max: 180,
        unit: '°'
      }
    ],
    aliases: ['left', 'rotate left']
  },
  {
    id: 'turn.right',
    name: 'turn right',
    description: 'Turn rover right by specified angle',
    category: 'navigation',
    syntax: 'turn right <angle>',
    confirmationRequired: false,
    requiresConnection: true,
    dangerLevel: 'low',
    executionTime: 'short',
    parameters: [
      {
        name: 'angle',
        type: 'number',
        description: 'Angle to turn in degrees',
        required: true,
        min: 1,
        max: 180,
        unit: '°'
      }
    ],
    aliases: ['right', 'rotate right']
  },
  {
    id: 'goto.coordinates',
    name: 'goto coordinates',
    description: 'Navigate to specific GPS coordinates',
    category: 'navigation',
    syntax: 'goto <latitude> <longitude> [altitude]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'high',
    executionTime: 'long',
    parameters: [
      {
        name: 'latitude',
        type: 'number',
        description: 'Target latitude in decimal degrees',
        required: true,
        min: -90,
        max: 90
      },
      {
        name: 'longitude',
        type: 'number',
        description: 'Target longitude in decimal degrees',
        required: true,
        min: -180,
        max: 180
      },
      {
        name: 'altitude',
        type: 'number',
        description: 'Target altitude in meters (optional)',
        required: false,
        min: 0,
        max: 8848,
        unit: 'm'
      }
    ],
    aliases: ['navigate to', 'go to', 'goto']
  }
];

export const SAMPLING_COMMANDS: Command[] = [
  {
    id: 'sample.soil',
    name: 'sample soil',
    description: 'Collect soil sample at current location',
    category: 'sampling',
    syntax: 'sample soil [depth] [container]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'medium',
    executionTime: 'long',
    parameters: [
      {
        name: 'depth',
        type: 'number',
        description: 'Sampling depth in centimeters',
        required: false,
        default: 5,
        min: 1,
        max: 50,
        unit: 'cm'
      },
      {
        name: 'container',
        type: 'select',
        description: 'Sample container ID',
        required: false,
        default: 'auto',
        options: [
          { value: 'auto', label: 'Auto-select' },
          { value: 'A1', label: 'Container A1' },
          { value: 'A2', label: 'Container A2' },
          { value: 'B1', label: 'Container B1' },
          { value: 'B2', label: 'Container B2' }
        ]
      }
    ],
    aliases: ['collect soil', 'soil sample', 'dig']
  },
  {
    id: 'sample.rock',
    name: 'sample rock',
    description: 'Collect rock sample using drill',
    category: 'sampling',
    syntax: 'sample rock [power] [duration]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'high',
    executionTime: 'long',
    parameters: [
      {
        name: 'power',
        type: 'range',
        description: 'Drill power percentage',
        required: false,
        default: 50,
        min: 10,
        max: 100,
        unit: '%'
      },
      {
        name: 'duration',
        type: 'number',
        description: 'Drilling duration in seconds',
        required: false,
        default: 30,
        min: 5,
        max: 300,
        unit: 's'
      }
    ],
    aliases: ['drill', 'rock sample', 'collect rock']
  }
];

export const SYSTEM_COMMANDS: Command[] = [
  {
    id: 'status',
    name: 'status',
    description: 'Display rover system status',
    category: 'system',
    syntax: 'status [subsystem]',
    confirmationRequired: false,
    requiresConnection: true,
    dangerLevel: 'none',
    executionTime: 'instant',
    parameters: [
      {
        name: 'subsystem',
        type: 'select',
        description: 'Specific subsystem to check',
        required: false,
        options: [
          { value: 'all', label: 'All systems' },
          { value: 'power', label: 'Power system' },
          { value: 'navigation', label: 'Navigation' },
          { value: 'communication', label: 'Communication' },
          { value: 'sampling', label: 'Sampling equipment' },
          { value: 'thermal', label: 'Thermal management' }
        ]
      }
    ],
    aliases: ['stat', 'info', 'health']
  },
  {
    id: 'reboot',
    name: 'reboot',
    description: 'Restart rover systems',
    category: 'system',
    syntax: 'reboot [subsystem]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'high',
    executionTime: 'medium',
    parameters: [
      {
        name: 'subsystem',
        type: 'select',
        description: 'System to reboot',
        required: false,
        default: 'all',
        options: [
          { value: 'all', label: 'All systems' },
          { value: 'navigation', label: 'Navigation only' },
          { value: 'communication', label: 'Communication only' },
          { value: 'sampling', label: 'Sampling equipment only' }
        ]
      }
    ],
    aliases: ['restart', 'reset']
  },
  {
    id: 'sleep',
    name: 'sleep',
    description: 'Put rover into low-power sleep mode',
    category: 'system',
    syntax: 'sleep [duration]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'medium',
    executionTime: 'instant',
    parameters: [
      {
        name: 'duration',
        type: 'number',
        description: 'Sleep duration in minutes (0 = indefinite)',
        required: false,
        default: 0,
        min: 0,
        max: 1440,
        unit: 'min'
      }
    ],
    aliases: ['hibernate', 'standby', 'power down']
  }
];

export const EMERGENCY_COMMANDS: Command[] = [
  {
    id: 'emergency.stop',
    name: 'emergency stop',
    description: 'Immediately halt all rover operations',
    category: 'emergency',
    syntax: 'emergency stop',
    confirmationRequired: false,
    requiresConnection: true,
    dangerLevel: 'critical',
    executionTime: 'instant',
    parameters: [],
    aliases: ['estop', 'stop', 'halt', 'emergency', 'abort']
  },
  {
    id: 'emergency.home',
    name: 'return home',
    description: 'Navigate back to home position using GPS',
    category: 'emergency',
    syntax: 'return home [mode]',
    confirmationRequired: true,
    requiresConnection: true,
    dangerLevel: 'high',
    executionTime: 'long',
    parameters: [
      {
        name: 'mode',
        type: 'select',
        description: 'Navigation mode for return journey',
        required: false,
        default: 'safe',
        options: [
          { value: 'safe', label: 'Safe (avoid obstacles)' },
          { value: 'direct', label: 'Direct (shortest path)' },
          { value: 'manual', label: 'Manual waypoints' }
        ]
      }
    ],
    aliases: ['go home', 'return', 'home']
  }
];

export const TELEMETRY_COMMANDS: Command[] = [
  {
    id: 'telemetry.start',
    name: 'start telemetry',
    description: 'Begin telemetry data streaming',
    category: 'telemetry',
    syntax: 'start telemetry [rate]',
    confirmationRequired: false,
    requiresConnection: true,
    dangerLevel: 'none',
    executionTime: 'instant',
    parameters: [
      {
        name: 'rate',
        type: 'select',
        description: 'Data transmission rate',
        required: false,
        default: 'normal',
        options: [
          { value: 'low', label: 'Low (1 Hz)' },
          { value: 'normal', label: 'Normal (10 Hz)' },
          { value: 'high', label: 'High (50 Hz)' },
          { value: 'burst', label: 'Burst (100 Hz)' }
        ]
      }
    ],
    aliases: ['telemetry on', 'start streaming']
  },
  {
    id: 'telemetry.stop',
    name: 'stop telemetry',
    description: 'Stop telemetry data streaming',
    category: 'telemetry',
    syntax: 'stop telemetry',
    confirmationRequired: false,
    requiresConnection: true,
    dangerLevel: 'none',
    executionTime: 'instant',
    parameters: [],
    aliases: ['telemetry off', 'stop streaming']
  }
];

// Combine all commands
export const ALL_COMMANDS: Command[] = [
  ...NAVIGATION_COMMANDS,
  ...SAMPLING_COMMANDS,
  ...SYSTEM_COMMANDS,
  ...EMERGENCY_COMMANDS,
  ...TELEMETRY_COMMANDS
];

// Command categories with metadata
export const COMMAND_CATEGORIES = {
  navigation: {
    name: 'Navigation',
    description: 'Movement and positioning commands',
    color: '#4CAF50',
    icon: '🧭'
  },
  sampling: {
    name: 'Sampling',
    description: 'Sample collection and analysis',
    color: '#FF9800',
    icon: '🔬'
  },
  system: {
    name: 'System',
    description: 'System management and diagnostics',
    color: '#2196F3',
    icon: '⚙️'
  },
  emergency: {
    name: 'Emergency',
    description: 'Emergency and safety commands',
    color: '#F44336',
    icon: '🚨'
  },
  telemetry: {
    name: 'Telemetry',
    description: 'Data streaming and monitoring',
    color: '#9C27B0',
    icon: '📡'
  },
  hardware: {
    name: 'Hardware',
    description: 'Hardware control and diagnostics',
    color: '#607D8B',
    icon: '🔧'
  },
  communication: {
    name: 'Communication',
    description: 'Communication system controls',
    color: '#795548',
    icon: '📻'
  },
  diagnostic: {
    name: 'Diagnostic',
    description: 'System diagnostics and testing',
    color: '#FF5722',
    icon: '🔍'
  }
} as const;

// Quick action commands for toolbar
export const QUICK_ACTIONS = [
  'emergency stop',
  'status',
  'start telemetry',
  'return home'
] as const;