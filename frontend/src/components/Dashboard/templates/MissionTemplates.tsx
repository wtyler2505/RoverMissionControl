/**
 * Mission-Specific Dashboard Templates
 * Pre-configured dashboard layouts for common rover mission scenarios
 */

import React from 'react';
import {
  Dashboard,
  Speed,
  Memory,
  BugReport,
  Science,
  Warning,
  Satellite,
  Battery80,
  Thermostat,
  Timeline,
  Analytics,
  Engineering,
  Emergency
} from '@mui/icons-material';
import {
  DashboardTemplate,
  DashboardCategory,
  MissionPhase,
  DashboardPanel
} from '../../../types/dashboardTemplates';

/**
 * Real-time Mission Monitoring Dashboard
 * Provides comprehensive overview of all critical mission parameters
 */
export const missionMonitoringTemplate: DashboardTemplate = {
  id: 'mission-monitoring',
  name: 'Mission Monitoring',
  description: 'Real-time overview of all critical mission parameters for active operations',
  category: DashboardCategory.MONITORING,
  icon: <Dashboard />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'position-3d',
      templateId: 'position-tracking',
      position: { i: 'position-3d', x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
      customConfig: {
        title: 'Rover Position & Trajectory',
        options: {
          enable3D: true,
          showTrajectory: true,
          trajectoryLength: 1000
        }
      }
    },
    {
      id: 'battery-status',
      templateId: 'battery-management',
      position: { i: 'battery-status', x: 4, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
      customConfig: {
        title: 'Power System Status',
        options: {
          showPrediction: true,
          criticalThreshold: 20,
          warningThreshold: 30
        }
      }
    },
    {
      id: 'system-health',
      templateId: 'system-performance',
      position: { i: 'system-health', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
      customConfig: {
        title: 'System Health Monitor'
      }
    },
    {
      id: 'thermal-overview',
      templateId: 'temperature-monitoring',
      position: { i: 'thermal-overview', x: 0, y: 4, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Thermal Management',
        options: {
          showAllZones: true,
          tempUnit: 'celsius'
        }
      }
    },
    {
      id: 'comm-status',
      templateId: 'network-latency',
      position: { i: 'comm-status', x: 6, y: 4, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Communication Link Status',
        options: {
          showSignalStrength: true,
          showPacketLoss: true
        }
      }
    },
    {
      id: 'velocity-monitor',
      templateId: 'velocity-analysis',
      position: { i: 'velocity-monitor', x: 0, y: 7, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Motion Status'
      }
    },
    {
      id: 'environmental',
      templateId: 'environmental-monitoring',
      position: { i: 'environmental', x: 4, y: 7, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Environmental Conditions'
      }
    },
    {
      id: 'alerts-timeline',
      templateId: 'event-timeline',
      position: { i: 'alerts-timeline', x: 8, y: 7, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Mission Events',
        options: {
          filterTypes: ['warning', 'error', 'milestone']
        }
      }
    }
  ],
  
  defaultTimeWindow: 300000, // 5 minutes
  minTimeWindow: 60000, // 1 minute
  maxTimeWindow: 3600000, // 1 hour
  
  features: {
    autoRefresh: true,
    refreshInterval: 1000,
    syncTime: true,
    enableAnnotations: true,
    enable3DVisualization: true,
    enableExport: true
  },
  
  requiredStreams: [
    'position.x', 'position.y', 'position.z',
    'battery.voltage', 'battery.current', 'battery.soc',
    'system.cpu', 'system.memory',
    'temperature.cpu', 'temperature.battery',
    'comm.signal_strength', 'comm.latency'
  ],
  
  recommendedMissionPhases: [
    MissionPhase.OPERATION,
    MissionPhase.CRUISE
  ],
  
  tags: ['real-time', 'monitoring', 'operations', 'critical']
};

/**
 * Historical Analysis Dashboard
 * For deep analysis of past mission data
 */
export const historicalAnalysisTemplate: DashboardTemplate = {
  id: 'historical-analysis',
  name: 'Historical Analysis',
  description: 'Deep dive analysis tools for investigating past mission data',
  category: DashboardCategory.ANALYSIS,
  icon: <Analytics />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'correlation-matrix',
      templateId: 'correlation-analysis',
      position: { i: 'correlation-matrix', x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
      customConfig: {
        title: 'Parameter Correlation Analysis',
        options: {
          method: 'pearson',
          showSignificantOnly: true,
          threshold: 0.7
        }
      }
    },
    {
      id: 'trend-analysis',
      templateId: 'advanced-trends',
      position: { i: 'trend-analysis', x: 6, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
      customConfig: {
        title: 'Trend Analysis & Prediction',
        options: {
          enableARIMA: true,
          enableDriftDetection: true,
          predictionHorizon: 24 // hours
        }
      }
    },
    {
      id: 'anomaly-timeline',
      templateId: 'anomaly-detection',
      position: { i: 'anomaly-timeline', x: 0, y: 5, w: 12, h: 3, minW: 8, minH: 2 },
      customConfig: {
        title: 'Anomaly Detection Timeline',
        options: {
          detectionMethods: ['zscore', 'isolation-forest', 'moving-average'],
          sensitivityLevel: 'medium'
        }
      }
    },
    {
      id: 'frequency-analysis',
      templateId: 'frequency-domain',
      position: { i: 'frequency-analysis', x: 0, y: 8, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Frequency Domain Analysis',
        options: {
          fftSize: 2048,
          windowFunction: 'hamming',
          showPhase: false
        }
      }
    },
    {
      id: 'statistical-summary',
      templateId: 'statistical-analysis',
      position: { i: 'statistical-summary', x: 6, y: 8, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Statistical Summary',
        options: {
          showDistribution: true,
          showBoxPlot: true,
          calculateAdvancedMetrics: true
        }
      }
    }
  ],
  
  defaultTimeWindow: 86400000, // 24 hours
  minTimeWindow: 3600000, // 1 hour
  maxTimeWindow: 604800000, // 7 days
  
  features: {
    enablePlayback: true,
    syncTime: true,
    enableCorrelation: true,
    enableAnnotations: true,
    enableExport: true
  },
  
  requiredStreams: [], // Dynamic based on analysis needs
  optionalStreams: [
    'position.*', 'velocity.*', 'acceleration.*',
    'temperature.*', 'battery.*', 'system.*'
  ],
  
  tags: ['analysis', 'historical', 'research', 'investigation']
};

/**
 * System Diagnostics Dashboard
 * Comprehensive system health monitoring and diagnostics
 */
export const systemDiagnosticsTemplate: DashboardTemplate = {
  id: 'system-diagnostics',
  name: 'System Diagnostics',
  description: 'Detailed system health monitoring and diagnostic tools',
  category: DashboardCategory.DIAGNOSTICS,
  icon: <Engineering />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'cpu-memory',
      templateId: 'system-performance',
      position: { i: 'cpu-memory', x: 0, y: 0, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Computing Resources',
        options: {
          showProcessList: true,
          alertOnHighUsage: true
        }
      }
    },
    {
      id: 'thermal-zones',
      templateId: 'thermal-zones',
      position: { i: 'thermal-zones', x: 6, y: 0, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Thermal Zone Map',
        options: {
          showHeatmap: true,
          showTrends: true
        }
      }
    },
    {
      id: 'vibration',
      templateId: 'vibration-analysis',
      position: { i: 'vibration', x: 0, y: 3, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Vibration Analysis',
        options: {
          showFFT: true,
          showRMS: true
        }
      }
    },
    {
      id: 'power-distribution',
      templateId: 'power-consumption',
      position: { i: 'power-distribution', x: 4, y: 3, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Power Distribution',
        options: {
          showBySubsystem: true,
          showEfficiency: true
        }
      }
    },
    {
      id: 'error-analysis',
      templateId: 'error-logs',
      position: { i: 'error-analysis', x: 8, y: 3, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Error Analysis',
        options: {
          groupBySeverity: true,
          showTrends: true
        }
      }
    },
    {
      id: 'sensor-health',
      templateId: 'sensor-diagnostics',
      position: { i: 'sensor-health', x: 0, y: 6, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Sensor Health Matrix',
        options: {
          showCalibrationStatus: true,
          showNoiseLevel: true
        }
      }
    },
    {
      id: 'comm-diagnostics',
      templateId: 'communication-health',
      position: { i: 'comm-diagnostics', x: 6, y: 6, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Communication Diagnostics',
        options: {
          showBER: true,
          showRetransmissions: true
        }
      }
    }
  ],
  
  defaultTimeWindow: 3600000, // 1 hour
  
  features: {
    autoRefresh: true,
    refreshInterval: 5000,
    enableAnnotations: true,
    enableExport: true
  },
  
  requiredStreams: [
    'system.cpu', 'system.memory', 'system.disk',
    'temperature.*', 'vibration.*', 'power.*',
    'errors.*', 'comm.*'
  ],
  
  tags: ['diagnostics', 'maintenance', 'troubleshooting', 'health']
};

/**
 * Performance Optimization Dashboard
 * Tools for analyzing and optimizing rover performance
 */
export const performanceOptimizationTemplate: DashboardTemplate = {
  id: 'performance-optimization',
  name: 'Performance Optimization',
  description: 'Analyze and optimize rover performance metrics',
  category: DashboardCategory.OPTIMIZATION,
  icon: <Speed />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'velocity-efficiency',
      templateId: 'velocity-analysis',
      position: { i: 'velocity-efficiency', x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Motion Efficiency Analysis',
        options: {
          showEfficiencyMetrics: true,
          compareToOptimal: true
        }
      }
    },
    {
      id: 'power-efficiency',
      templateId: 'power-efficiency',
      position: { i: 'power-efficiency', x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Power Efficiency Metrics',
        options: {
          showEnergyPerDistance: true,
          showOptimalPath: true
        }
      }
    },
    {
      id: 'trajectory-3d',
      templateId: 'trajectory-optimization',
      position: { i: 'trajectory-3d', x: 0, y: 4, w: 8, h: 5, minW: 6, minH: 4 },
      customConfig: {
        title: '3D Trajectory Optimization',
        options: {
          show3D: true,
          showOptimalPath: true,
          showObstacles: true
        }
      }
    },
    {
      id: 'energy-forecast',
      templateId: 'energy-prediction',
      position: { i: 'energy-forecast', x: 8, y: 4, w: 4, h: 5, minW: 3, minH: 3 },
      customConfig: {
        title: 'Energy Forecast',
        options: {
          predictionHorizon: 8, // hours
          showConfidenceIntervals: true
        }
      }
    },
    {
      id: 'thermal-efficiency',
      templateId: 'thermal-optimization',
      position: { i: 'thermal-efficiency', x: 0, y: 9, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Thermal Efficiency'
      }
    },
    {
      id: 'comm-optimization',
      templateId: 'communication-optimization',
      position: { i: 'comm-optimization', x: 6, y: 9, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Communication Optimization'
      }
    }
  ],
  
  defaultTimeWindow: 7200000, // 2 hours
  
  features: {
    autoRefresh: true,
    refreshInterval: 10000,
    enable3DVisualization: true,
    enableAnnotations: true,
    enableExport: true
  },
  
  requiredStreams: [
    'position.*', 'velocity.*', 'acceleration.*',
    'power.*', 'battery.*', 'temperature.*',
    'trajectory.*', 'comm.*'
  ],
  
  tags: ['optimization', 'performance', 'efficiency', 'planning']
};

/**
 * Anomaly Investigation Dashboard
 * Specialized tools for investigating system anomalies
 */
export const anomalyInvestigationTemplate: DashboardTemplate = {
  id: 'anomaly-investigation',
  name: 'Anomaly Investigation',
  description: 'Tools for detecting and investigating system anomalies',
  category: DashboardCategory.DIAGNOSTICS,
  icon: <BugReport />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'anomaly-overview',
      templateId: 'anomaly-detection',
      position: { i: 'anomaly-overview', x: 0, y: 0, w: 8, h: 4, minW: 6, minH: 3 },
      customConfig: {
        title: 'Anomaly Detection Overview',
        options: {
          detectionMethods: ['all'],
          showAnomalyScore: true,
          realTimeDetection: true
        }
      }
    },
    {
      id: 'correlation-finder',
      templateId: 'correlation-analysis',
      position: { i: 'correlation-finder', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
      customConfig: {
        title: 'Correlation Finder',
        options: {
          focusOnAnomalies: true,
          lagAnalysis: true
        }
      }
    },
    {
      id: 'event-timeline-detail',
      templateId: 'event-timeline',
      position: { i: 'event-timeline-detail', x: 0, y: 4, w: 12, h: 2, minW: 8, minH: 2 },
      customConfig: {
        title: 'Event Timeline',
        options: {
          showAllEvents: true,
          highlightAnomalies: true
        }
      }
    },
    {
      id: 'root-cause',
      templateId: 'root-cause-analysis',
      position: { i: 'root-cause', x: 0, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Root Cause Analysis',
        options: {
          useML: true,
          showCausalChain: true
        }
      }
    },
    {
      id: 'pattern-recognition',
      templateId: 'pattern-analysis',
      position: { i: 'pattern-recognition', x: 6, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Pattern Recognition',
        options: {
          showSimilarEvents: true,
          clusterAnomalies: true
        }
      }
    },
    {
      id: 'impact-assessment',
      templateId: 'impact-analysis',
      position: { i: 'impact-assessment', x: 0, y: 10, w: 12, h: 3, minW: 8, minH: 2 },
      customConfig: {
        title: 'System Impact Assessment',
        options: {
          showAffectedSystems: true,
          predictFutureImpact: true
        }
      }
    }
  ],
  
  defaultTimeWindow: 3600000, // 1 hour around anomaly
  
  features: {
    autoRefresh: false, // Manual refresh for investigation
    enablePlayback: true,
    syncTime: true,
    enableCorrelation: true,
    enableAnnotations: true,
    enableExport: true
  },
  
  requiredStreams: [], // Dynamic based on anomaly
  
  tags: ['anomaly', 'investigation', 'debugging', 'root-cause']
};

/**
 * Emergency Response Dashboard
 * Critical information for emergency situations
 */
export const emergencyResponseTemplate: DashboardTemplate = {
  id: 'emergency-response',
  name: 'Emergency Response',
  description: 'Critical system status for emergency situations',
  category: DashboardCategory.EMERGENCY,
  icon: <Warning color="error" />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'critical-status',
      templateId: 'critical-systems',
      position: { i: 'critical-status', x: 0, y: 0, w: 12, h: 3, minW: 10, minH: 2 },
      customConfig: {
        title: 'CRITICAL SYSTEMS STATUS',
        options: {
          showOnlyCritical: true,
          largeDisplay: true,
          audioAlerts: true
        }
      }
    },
    {
      id: 'rover-location',
      templateId: 'position-tracking',
      position: { i: 'rover-location', x: 0, y: 3, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Current Location',
        options: {
          showCoordinates: true,
          showNearestSafeZone: true
        }
      }
    },
    {
      id: 'power-critical',
      templateId: 'battery-management',
      position: { i: 'power-critical', x: 6, y: 3, w: 6, h: 4, minW: 4, minH: 3 },
      customConfig: {
        title: 'Power Reserves',
        options: {
          showTimeRemaining: true,
          showEmergencyPower: true
        }
      }
    },
    {
      id: 'comm-emergency',
      templateId: 'communication-status',
      position: { i: 'comm-emergency', x: 0, y: 7, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Communication Status',
        options: {
          showBackupChannels: true
        }
      }
    },
    {
      id: 'thermal-critical',
      templateId: 'temperature-monitoring',
      position: { i: 'thermal-critical', x: 4, y: 7, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Thermal Status',
        options: {
          showOnlyCritical: true
        }
      }
    },
    {
      id: 'emergency-procedures',
      templateId: 'emergency-checklist',
      position: { i: 'emergency-procedures', x: 8, y: 7, w: 4, h: 3, minW: 3, minH: 2 },
      customConfig: {
        title: 'Emergency Procedures',
        options: {
          showActiveProtocols: true
        }
      }
    }
  ],
  
  defaultTimeWindow: 600000, // 10 minutes
  
  features: {
    autoRefresh: true,
    refreshInterval: 500, // Fast refresh
    lockLayout: true, // Prevent accidental changes
    enableExport: true
  },
  
  requiredStreams: [
    'critical.*',
    'position.*',
    'battery.*',
    'comm.status',
    'temperature.*'
  ],
  
  recommendedMissionPhases: [MissionPhase.EMERGENCY],
  
  tags: ['emergency', 'critical', 'safety', 'priority']
};

/**
 * Science Operations Dashboard
 * Optimized for science data collection and analysis
 */
export const scienceOperationsTemplate: DashboardTemplate = {
  id: 'science-operations',
  name: 'Science Operations',
  description: 'Tools for science instrument monitoring and data collection',
  category: DashboardCategory.SCIENCE,
  icon: <Science />,
  version: '1.0.0',
  
  panels: [
    {
      id: 'instrument-status',
      templateId: 'instrument-health',
      position: { i: 'instrument-status', x: 0, y: 0, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Science Instruments Status'
      }
    },
    {
      id: 'data-collection',
      templateId: 'data-acquisition',
      position: { i: 'data-collection', x: 6, y: 0, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Data Collection Progress'
      }
    },
    {
      id: 'spectral-analysis',
      templateId: 'spectral-data',
      position: { i: 'spectral-analysis', x: 0, y: 3, w: 8, h: 4, minW: 6, minH: 3 },
      customConfig: {
        title: 'Spectral Analysis'
      }
    },
    {
      id: 'sample-tracking',
      templateId: 'sample-management',
      position: { i: 'sample-tracking', x: 8, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
      customConfig: {
        title: 'Sample Tracking'
      }
    },
    {
      id: 'environmental-science',
      templateId: 'environmental-monitoring',
      position: { i: 'environmental-science', x: 0, y: 7, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Environmental Measurements'
      }
    },
    {
      id: 'science-timeline',
      templateId: 'experiment-timeline',
      position: { i: 'science-timeline', x: 6, y: 7, w: 6, h: 3, minW: 4, minH: 2 },
      customConfig: {
        title: 'Experiment Timeline'
      }
    }
  ],
  
  defaultTimeWindow: 3600000, // 1 hour
  
  features: {
    autoRefresh: true,
    refreshInterval: 5000,
    enableAnnotations: true,
    enableExport: true
  },
  
  requiredStreams: [
    'instruments.*',
    'science.*',
    'environmental.*',
    'samples.*'
  ],
  
  recommendedMissionPhases: [MissionPhase.OPERATION],
  
  tags: ['science', 'research', 'data-collection', 'experiments']
};

/**
 * Collection of all dashboard templates
 */
export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  missionMonitoringTemplate,
  historicalAnalysisTemplate,
  systemDiagnosticsTemplate,
  performanceOptimizationTemplate,
  anomalyInvestigationTemplate,
  emergencyResponseTemplate,
  scienceOperationsTemplate
];

/**
 * Get dashboard template by ID
 */
export function getDashboardTemplate(id: string): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find(template => template.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: DashboardCategory): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES.filter(template => template.category === category);
}

/**
 * Get templates for mission phase
 */
export function getTemplatesForPhase(phase: MissionPhase): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES.filter(template => 
    template.recommendedMissionPhases?.includes(phase)
  );
}