/**
 * Dashboard Template Types
 * Definitions for pre-configured dashboard layouts and mission-specific templates
 */

import { ReactNode } from 'react';
import { Layout } from 'react-grid-layout';
import { ChartConfig } from '../components/Telemetry/ComprehensiveDashboard';
import { ChartTemplate } from '../components/Telemetry/ChartTemplates';

/**
 * Mission phases for context-aware templates
 */
export enum MissionPhase {
  PRE_LAUNCH = 'pre-launch',
  LAUNCH = 'launch',
  CRUISE = 'cruise',
  LANDING = 'landing',
  OPERATION = 'operation',
  EMERGENCY = 'emergency',
  MAINTENANCE = 'maintenance'
}

/**
 * Dashboard template categories
 */
export enum DashboardCategory {
  MONITORING = 'monitoring',
  ANALYSIS = 'analysis',
  DIAGNOSTICS = 'diagnostics',
  OPTIMIZATION = 'optimization',
  SCIENCE = 'science',
  EMERGENCY = 'emergency'
}

/**
 * Panel configuration within a dashboard template
 */
export interface DashboardPanel {
  id: string;
  templateId: string; // References ChartTemplate ID
  position: Layout;
  customConfig?: Partial<ChartConfig>;
  conditionalVisibility?: {
    requiredStreams?: string[];
    missionPhases?: MissionPhase[];
    condition?: (context: DashboardContext) => boolean;
  };
}

/**
 * Dashboard template feature flags
 */
export interface DashboardFeatures {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enablePlayback?: boolean;
  syncTime?: boolean;
  enableCorrelation?: boolean;
  enableAnnotations?: boolean;
  enable3DVisualization?: boolean;
  enableExport?: boolean;
  lockLayout?: boolean;
}

/**
 * Dashboard context for dynamic templates
 */
export interface DashboardContext {
  activeStreams: string[];
  missionPhase: MissionPhase;
  anomaliesDetected: boolean;
  userRole: string;
  systemStatus: Record<string, 'normal' | 'warning' | 'critical'>;
  timestamp: number;
}

/**
 * Dashboard template definition
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: DashboardCategory;
  icon: ReactNode;
  thumbnail?: string; // Preview image URL
  
  // Layout configuration
  panels: DashboardPanel[];
  gridCols?: number; // Default 12
  rowHeight?: number; // Default 30
  
  // Time configuration
  defaultTimeWindow: number; // milliseconds
  minTimeWindow?: number;
  maxTimeWindow?: number;
  
  // Features
  features: DashboardFeatures;
  
  // Requirements
  requiredStreams: string[];
  optionalStreams?: string[];
  recommendedMissionPhases?: MissionPhase[];
  
  // Metadata
  author?: string;
  version: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  
  // Advanced
  extends?: string; // Base template ID for inheritance
  onLoad?: (context: DashboardContext) => void;
  onUnload?: () => void;
}

/**
 * Quick action for mission-critical operations
 */
export interface QuickAction {
  id: string;
  name: string;
  icon: ReactNode;
  description: string;
  category: 'safety' | 'navigation' | 'power' | 'communication' | 'science';
  action: () => void | Promise<void>;
  confirmRequired?: boolean;
  hotkey?: string;
  enabledCondition?: (context: DashboardContext) => boolean;
}

/**
 * Dashboard instance created from template
 */
export interface DashboardInstance {
  id: string;
  templateId: string;
  name: string;
  config: {
    layout: Layout[];
    charts: ChartConfig[];
    features: DashboardFeatures;
  };
  customizations: {
    addedPanels: string[];
    removedPanels: string[];
    modifiedPanels: Record<string, Partial<ChartConfig>>;
  };
  metadata: {
    createdAt: string;
    createdBy: string;
    lastModified: string;
    lastModifiedBy: string;
  };
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingStreams: string[];
  performanceImpact: 'low' | 'medium' | 'high';
  estimatedLoadTime: number; // milliseconds
}

/**
 * Template recommendation
 */
export interface TemplateRecommendation {
  template: DashboardTemplate;
  score: number; // 0-100
  reasons: string[];
  missingRequirements: string[];
}

/**
 * Predefined mission operation modes
 */
export const OPERATION_MODES = {
  NORMAL: 'normal',
  LOW_POWER: 'low_power',
  SCIENCE: 'science',
  NAVIGATION: 'navigation',
  EMERGENCY: 'emergency',
  MAINTENANCE: 'maintenance',
  NIGHT: 'night'
} as const;

export type OperationMode = typeof OPERATION_MODES[keyof typeof OPERATION_MODES];

/**
 * Dashboard template export format
 */
export interface DashboardTemplateExport {
  version: string;
  exportDate: string;
  templates: DashboardTemplate[];
  metadata: {
    exportedBy: string;
    description?: string;
    missionName?: string;
  };
}

/**
 * Template modification for inheritance
 */
export interface TemplateModification {
  addPanels?: DashboardPanel[];
  removePanels?: string[]; // Panel IDs
  updatePanels?: Array<{
    id: string;
    changes: Partial<DashboardPanel>;
  }>;
  updateFeatures?: Partial<DashboardFeatures>;
  updateTimeWindow?: number;
}

/**
 * Dashboard template metadata for UI display
 */
export interface DashboardTemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: DashboardCategory;
  icon: ReactNode;
  thumbnail?: string;
  panelCount: number;
  requiredStreamCount: number;
  features: string[]; // Human-readable feature list
  tags: string[];
  popularity?: number; // Usage count
  lastUsed?: string;
  isFavorite?: boolean;
}