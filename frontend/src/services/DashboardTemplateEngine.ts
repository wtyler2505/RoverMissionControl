/**
 * DashboardTemplateEngine - Instantiates and manages dashboard templates
 */

import {
  DashboardTemplate,
  DashboardContext,
  DashboardInstance,
  TemplateRecommendation,
  DashboardPanel,
  MissionPhase,
  DashboardCategory
} from '../types/dashboardTemplates';
import { ChartConfig } from '../components/Telemetry/ComprehensiveDashboard';
import { Layout } from 'react-grid-layout';
import { getChartTemplate } from '../components/Telemetry/ChartTemplates';

/**
 * Dashboard template engine
 */
export class DashboardTemplateEngine {
  /**
   * Instantiate a dashboard from template
   */
  instantiateDashboard(
    template: DashboardTemplate,
    context: DashboardContext,
    customName?: string
  ): DashboardInstance {
    const layout: Layout[] = [];
    const charts: ChartConfig[] = [];
    
    // Process each panel
    for (const panel of template.panels) {
      // Check conditional visibility
      if (this.shouldShowPanel(panel, context)) {
        // Create layout item
        layout.push({
          i: panel.id,
          ...panel.position
        });
        
        // Create chart config
        const chartTemplate = getChartTemplate(panel.templateId);
        if (chartTemplate) {
          const chartConfig: ChartConfig = {
            id: panel.id,
            title: panel.customConfig?.title || chartTemplate.name,
            streamIds: this.resolveStreamIds(chartTemplate.recommendedStreams, context),
            template: panel.templateId,
            series: [],
            yAxes: chartTemplate.yAxes,
            options: {
              ...chartTemplate.chartOptions,
              ...panel.customConfig?.options
            }
          };
          
          charts.push(chartConfig);
        }
      }
    }
    
    // Create dashboard instance
    const instance: DashboardInstance = {
      id: `dashboard_${Date.now()}`,
      templateId: template.id,
      name: customName || template.name,
      config: {
        layout,
        charts,
        features: { ...template.features }
      },
      customizations: {
        addedPanels: [],
        removedPanels: [],
        modifiedPanels: {}
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: context.userRole,
        lastModified: new Date().toISOString(),
        lastModifiedBy: context.userRole
      }
    };
    
    // Call template onLoad hook
    if (template.onLoad) {
      template.onLoad(context);
    }
    
    return instance;
  }
  
  /**
   * Check if panel should be shown
   */
  private shouldShowPanel(panel: DashboardPanel, context: DashboardContext): boolean {
    if (!panel.conditionalVisibility) return true;
    
    const { requiredStreams, missionPhases, condition } = panel.conditionalVisibility;
    
    // Check required streams
    if (requiredStreams) {
      const hasAllStreams = requiredStreams.every(stream => 
        context.activeStreams.includes(stream)
      );
      if (!hasAllStreams) return false;
    }
    
    // Check mission phases
    if (missionPhases) {
      if (!missionPhases.includes(context.missionPhase)) return false;
    }
    
    // Check custom condition
    if (condition) {
      if (!condition(context)) return false;
    }
    
    return true;
  }
  
  /**
   * Resolve stream IDs with wildcards
   */
  private resolveStreamIds(patterns: string[], context: DashboardContext): string[] {
    const resolved: string[] = [];
    
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Wildcard pattern
        const regex = new RegExp(pattern.replace('*', '.*'));
        const matches = context.activeStreams.filter(stream => regex.test(stream));
        resolved.push(...matches);
      } else {
        // Exact match
        if (context.activeStreams.includes(pattern)) {
          resolved.push(pattern);
        }
      }
    }
    
    return [...new Set(resolved)]; // Remove duplicates
  }
  
  /**
   * Recommend templates based on context
   */
  recommendTemplates(context: DashboardContext): TemplateRecommendation[] {
    const recommendations: TemplateRecommendation[] = [];
    
    // Import templates (would normally be injected)
    const { DASHBOARD_TEMPLATES } = require('../components/Dashboard/templates/MissionTemplates');
    
    for (const template of DASHBOARD_TEMPLATES) {
      const score = this.calculateRecommendationScore(template, context);
      const reasons: string[] = [];
      const missingRequirements: string[] = [];
      
      // Check mission phase match
      if (template.recommendedMissionPhases?.includes(context.missionPhase)) {
        reasons.push(`Optimized for ${context.missionPhase} phase`);
      }
      
      // Check anomaly detection
      if (context.anomaliesDetected && template.category === DashboardCategory.DIAGNOSTICS) {
        reasons.push('Helps investigate detected anomalies');
      }
      
      // Check emergency status
      if (context.missionPhase === MissionPhase.EMERGENCY && 
          template.category === DashboardCategory.EMERGENCY) {
        reasons.push('Critical for emergency response');
      }
      
      // Check stream availability
      const availableStreams = template.requiredStreams.filter(stream =>
        context.activeStreams.includes(stream)
      );
      const streamCoverage = availableStreams.length / template.requiredStreams.length;
      
      if (streamCoverage === 1) {
        reasons.push('All required data streams available');
      } else if (streamCoverage > 0.8) {
        reasons.push('Most required data streams available');
      }
      
      // Check missing requirements
      const missingStreams = template.requiredStreams.filter(stream =>
        !context.activeStreams.includes(stream) && !stream.includes('*')
      );
      if (missingStreams.length > 0) {
        missingRequirements.push(`Missing streams: ${missingStreams.join(', ')}`);
      }
      
      // Add recommendation if score is high enough
      if (score > 30) {
        recommendations.push({
          template,
          score: Math.round(score),
          reasons,
          missingRequirements
        });
      }
    }
    
    // Sort by score
    return recommendations.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Calculate recommendation score
   */
  private calculateRecommendationScore(
    template: DashboardTemplate,
    context: DashboardContext
  ): number {
    let score = 50; // Base score
    
    // Mission phase match (high weight)
    if (template.recommendedMissionPhases?.includes(context.missionPhase)) {
      score += 30;
    }
    
    // Emergency priority
    if (context.missionPhase === MissionPhase.EMERGENCY) {
      if (template.category === DashboardCategory.EMERGENCY) {
        score += 50; // High priority
      } else {
        score -= 20; // Lower priority for non-emergency templates
      }
    }
    
    // Anomaly detection
    if (context.anomaliesDetected) {
      if (template.category === DashboardCategory.DIAGNOSTICS ||
          template.id === 'anomaly-investigation') {
        score += 25;
      }
    }
    
    // Stream availability
    const requiredCount = template.requiredStreams.length;
    const availableCount = template.requiredStreams.filter(stream =>
      context.activeStreams.includes(stream) || stream.includes('*')
    ).length;
    
    const availability = requiredCount > 0 ? availableCount / requiredCount : 1;
    score += availability * 20;
    
    // System status considerations
    const criticalSystems = Object.values(context.systemStatus).filter(
      status => status === 'critical'
    ).length;
    
    if (criticalSystems > 0) {
      if (template.category === DashboardCategory.DIAGNOSTICS ||
          template.category === DashboardCategory.MONITORING) {
        score += 15;
      }
    }
    
    // User role considerations
    if (context.userRole === 'operator' && template.category === DashboardCategory.MONITORING) {
      score += 10;
    } else if (context.userRole === 'analyst' && template.category === DashboardCategory.ANALYSIS) {
      score += 10;
    } else if (context.userRole === 'engineer' && template.category === DashboardCategory.DIAGNOSTICS) {
      score += 10;
    }
    
    // Time-based scoring
    const currentHour = new Date(context.timestamp).getHours();
    if (currentHour >= 22 || currentHour <= 6) {
      // Night operations
      if (template.tags?.includes('night') || template.tags?.includes('low-power')) {
        score += 5;
      }
    }
    
    // Cap score at 100
    return Math.min(score, 100);
  }
  
  /**
   * Merge two dashboard instances
   */
  mergeDashboards(
    primary: DashboardInstance,
    secondary: DashboardInstance
  ): DashboardInstance {
    // Find max Y position in primary layout
    let maxY = 0;
    for (const item of primary.config.layout) {
      const bottom = item.y + item.h;
      if (bottom > maxY) maxY = bottom;
    }
    
    // Offset secondary layout
    const offsetLayout = secondary.config.layout.map(item => ({
      ...item,
      y: item.y + maxY + 1
    }));
    
    // Merge configurations
    return {
      ...primary,
      id: `merged_${Date.now()}`,
      name: `${primary.name} + ${secondary.name}`,
      config: {
        layout: [...primary.config.layout, ...offsetLayout],
        charts: [...primary.config.charts, ...secondary.config.charts],
        features: {
          ...primary.config.features,
          ...secondary.config.features
        }
      },
      customizations: {
        addedPanels: [
          ...primary.customizations.addedPanels,
          ...secondary.customizations.addedPanels
        ],
        removedPanels: [
          ...primary.customizations.removedPanels,
          ...secondary.customizations.removedPanels
        ],
        modifiedPanels: {
          ...primary.customizations.modifiedPanels,
          ...secondary.customizations.modifiedPanels
        }
      },
      metadata: {
        ...primary.metadata,
        lastModified: new Date().toISOString()
      }
    };
  }
  
  /**
   * Apply template modifications
   */
  applyModifications(
    instance: DashboardInstance,
    modifications: {
      addPanels?: DashboardPanel[];
      removePanels?: string[];
      updatePanels?: Array<{ id: string; changes: Partial<ChartConfig> }>;
    }
  ): DashboardInstance {
    const updated = { ...instance };
    
    // Remove panels
    if (modifications.removePanels) {
      updated.config.layout = updated.config.layout.filter(
        item => !modifications.removePanels!.includes(item.i)
      );
      updated.config.charts = updated.config.charts.filter(
        chart => !modifications.removePanels!.includes(chart.id)
      );
      updated.customizations.removedPanels.push(...modifications.removePanels);
    }
    
    // Add panels
    if (modifications.addPanels) {
      // Process new panels similar to instantiation
      // (Implementation would follow similar pattern)
    }
    
    // Update panels
    if (modifications.updatePanels) {
      for (const update of modifications.updatePanels) {
        const chartIndex = updated.config.charts.findIndex(c => c.id === update.id);
        if (chartIndex !== -1) {
          updated.config.charts[chartIndex] = {
            ...updated.config.charts[chartIndex],
            ...update.changes
          };
          updated.customizations.modifiedPanels[update.id] = update.changes;
        }
      }
    }
    
    updated.metadata.lastModified = new Date().toISOString();
    
    return updated;
  }
  
  /**
   * Export dashboard instance to template
   */
  exportAsTemplate(instance: DashboardInstance): DashboardTemplate {
    const panels: DashboardPanel[] = instance.config.layout.map(layoutItem => {
      const chart = instance.config.charts.find(c => c.id === layoutItem.i);
      
      return {
        id: layoutItem.i,
        templateId: chart?.template || 'custom',
        position: {
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h,
          minW: layoutItem.minW,
          minH: layoutItem.minH
        },
        customConfig: chart ? {
          title: chart.title,
          options: chart.options
        } : undefined
      };
    });
    
    return {
      id: `template_${Date.now()}`,
      name: `${instance.name} Template`,
      description: `Template created from ${instance.name}`,
      category: DashboardCategory.MONITORING,
      icon: null,
      panels,
      defaultTimeWindow: 300000,
      features: instance.config.features,
      requiredStreams: [],
      version: '1.0.0'
    };
  }
}

export default DashboardTemplateEngine;