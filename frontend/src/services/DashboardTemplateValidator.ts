/**
 * DashboardTemplateValidator - Validates dashboard templates
 */

import {
  DashboardTemplate,
  DashboardContext,
  TemplateValidationResult,
  MissionPhase
} from '../types/dashboardTemplates';

/**
 * Dashboard template validator
 */
export class DashboardTemplateValidator {
  /**
   * Validate a dashboard template
   */
  async validateTemplate(
    template: DashboardTemplate,
    context: DashboardContext
  ): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingStreams: string[] = [];
    
    // Basic validation
    if (!template.id) {
      errors.push('Template must have an ID');
    }
    
    if (!template.name) {
      errors.push('Template must have a name');
    }
    
    if (!template.panels || template.panels.length === 0) {
      errors.push('Template must have at least one panel');
    }
    
    // Validate panels
    const panelIds = new Set<string>();
    const gridOccupancy = new Map<string, string>();
    
    for (const panel of template.panels) {
      // Check for duplicate IDs
      if (panelIds.has(panel.id)) {
        errors.push(`Duplicate panel ID: ${panel.id}`);
      }
      panelIds.add(panel.id);
      
      // Validate position
      const { x, y, w, h } = panel.position;
      
      if (x < 0 || y < 0 || w <= 0 || h <= 0) {
        errors.push(`Invalid position for panel ${panel.id}`);
      }
      
      if (x + w > (template.gridCols || 12)) {
        errors.push(`Panel ${panel.id} exceeds grid width`);
      }
      
      // Check for overlaps
      for (let i = x; i < x + w; i++) {
        for (let j = y; j < y + h; j++) {
          const key = `${i},${j}`;
          if (gridOccupancy.has(key)) {
            warnings.push(
              `Panel ${panel.id} overlaps with ${gridOccupancy.get(key)} at position (${i}, ${j})`
            );
          }
          gridOccupancy.set(key, panel.id);
        }
      }
      
      // Check conditional visibility
      if (panel.conditionalVisibility) {
        if (panel.conditionalVisibility.missionPhases) {
          const currentPhase = context.missionPhase;
          if (!panel.conditionalVisibility.missionPhases.includes(currentPhase)) {
            warnings.push(
              `Panel ${panel.id} is not recommended for current mission phase: ${currentPhase}`
            );
          }
        }
      }
    }
    
    // Validate required streams
    for (const stream of template.requiredStreams) {
      if (!context.activeStreams.includes(stream) && !stream.includes('*')) {
        missingStreams.push(stream);
      }
    }
    
    if (missingStreams.length > 0) {
      errors.push(`Missing required streams: ${missingStreams.join(', ')}`);
    }
    
    // Validate time window
    if (template.defaultTimeWindow <= 0) {
      errors.push('Default time window must be positive');
    }
    
    if (template.minTimeWindow && template.maxTimeWindow) {
      if (template.minTimeWindow > template.maxTimeWindow) {
        errors.push('Minimum time window cannot exceed maximum time window');
      }
      
      if (template.defaultTimeWindow < template.minTimeWindow ||
          template.defaultTimeWindow > template.maxTimeWindow) {
        warnings.push('Default time window is outside min/max range');
      }
    }
    
    // Validate features
    if (template.features.autoRefresh && !template.features.refreshInterval) {
      warnings.push('Auto-refresh enabled but no refresh interval specified');
    }
    
    if (template.features.refreshInterval && template.features.refreshInterval < 100) {
      warnings.push('Refresh interval below 100ms may impact performance');
    }
    
    // Check mission phase recommendations
    if (template.recommendedMissionPhases) {
      if (!template.recommendedMissionPhases.includes(context.missionPhase)) {
        warnings.push(
          `Template is not optimized for current mission phase: ${context.missionPhase}`
        );
      }
    }
    
    // Emergency template validation
    if (template.category === 'emergency' && context.missionPhase !== MissionPhase.EMERGENCY) {
      warnings.push('Emergency template used outside of emergency phase');
    }
    
    // Calculate performance impact
    const performanceImpact = this.calculatePerformanceImpact(template, context);
    
    // Estimate load time
    const estimatedLoadTime = this.estimateLoadTime(template, context);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      missingStreams,
      performanceImpact,
      estimatedLoadTime
    };
  }
  
  /**
   * Calculate performance impact
   */
  private calculatePerformanceImpact(
    template: DashboardTemplate,
    context: DashboardContext
  ): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Panel count impact
    score += template.panels.length * 2;
    
    // Feature impact
    if (template.features.enable3DVisualization) score += 10;
    if (template.features.enableCorrelation) score += 5;
    if (template.features.autoRefresh) {
      const interval = template.features.refreshInterval || 1000;
      if (interval < 500) score += 10;
      else if (interval < 1000) score += 5;
      else score += 2;
    }
    
    // Stream count impact
    const activeStreams = template.requiredStreams.filter(
      stream => context.activeStreams.includes(stream)
    ).length;
    score += activeStreams;
    
    // Time window impact
    const hours = template.defaultTimeWindow / (1000 * 60 * 60);
    if (hours > 24) score += 5;
    if (hours > 168) score += 10; // More than a week
    
    // Determine impact level
    if (score < 15) return 'low';
    if (score < 30) return 'medium';
    return 'high';
  }
  
  /**
   * Estimate load time
   */
  private estimateLoadTime(
    template: DashboardTemplate,
    context: DashboardContext
  ): number {
    // Base load time
    let loadTime = 500; // 500ms base
    
    // Add time per panel
    loadTime += template.panels.length * 200;
    
    // Add time for features
    if (template.features.enable3DVisualization) loadTime += 1000;
    if (template.features.enableCorrelation) loadTime += 500;
    
    // Add time for data loading
    const dataPoints = this.estimateDataPoints(template, context);
    loadTime += Math.min(dataPoints / 10, 2000); // Cap at 2 seconds
    
    return loadTime;
  }
  
  /**
   * Estimate number of data points
   */
  private estimateDataPoints(
    template: DashboardTemplate,
    context: DashboardContext
  ): number {
    const timeWindow = template.defaultTimeWindow;
    const refreshRate = template.features.refreshInterval || 1000;
    const pointsPerStream = timeWindow / refreshRate;
    const activeStreams = template.requiredStreams.filter(
      stream => context.activeStreams.includes(stream)
    ).length;
    
    return pointsPerStream * activeStreams * template.panels.length;
  }
  
  /**
   * Validate template compatibility
   */
  validateCompatibility(
    template1: DashboardTemplate,
    template2: DashboardTemplate
  ): boolean {
    // Check if templates can be merged
    const allPanelIds = new Set<string>();
    
    for (const panel of [...template1.panels, ...template2.panels]) {
      if (allPanelIds.has(panel.id)) {
        return false; // Duplicate panel IDs
      }
      allPanelIds.add(panel.id);
    }
    
    return true;
  }
  
  /**
   * Suggest fixes for validation errors
   */
  suggestFixes(result: TemplateValidationResult): string[] {
    const suggestions: string[] = [];
    
    // Suggest stream alternatives
    if (result.missingStreams.length > 0) {
      suggestions.push(
        'Consider using optional streams or reducing required streams'
      );
    }
    
    // Suggest performance improvements
    if (result.performanceImpact === 'high') {
      suggestions.push(
        'Consider reducing panel count or disabling resource-intensive features'
      );
      suggestions.push(
        'Increase refresh interval to reduce update frequency'
      );
    }
    
    // Suggest layout fixes
    for (const warning of result.warnings) {
      if (warning.includes('overlaps')) {
        suggestions.push(
          'Use automatic layout adjustment to fix panel overlaps'
        );
        break;
      }
    }
    
    return suggestions;
  }
}

export default DashboardTemplateValidator;