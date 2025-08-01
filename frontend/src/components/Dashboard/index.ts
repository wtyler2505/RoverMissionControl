/**
 * Dashboard Components Export
 * Central export for all dashboard-related components
 */

// Template components
export { DashboardTemplateManager } from './DashboardTemplateManager';
export type { DashboardTemplateManagerProps } from './DashboardTemplateManager';

export { DashboardTemplatePreview } from './DashboardTemplatePreview';
export type { DashboardTemplatePreviewProps } from './DashboardTemplatePreview';

export { QuickActionsToolbar } from './QuickActionsToolbar';
export type { QuickActionsToolbarProps } from './QuickActionsToolbar';

// Template definitions
export * from './templates/MissionTemplates';

// Services
export { DashboardTemplateValidator } from '../../services/DashboardTemplateValidator';
export { DashboardTemplateEngine } from '../../services/DashboardTemplateEngine';

// Types
export * from '../../types/dashboardTemplates';