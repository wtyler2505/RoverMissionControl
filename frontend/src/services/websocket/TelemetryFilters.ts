/**
 * TelemetryFilters - Advanced Filtering Capabilities for Telemetry Data
 * 
 * Provides comprehensive filtering capabilities including:
 * - Property-based filters (numeric ranges, string patterns, boolean conditions)
 * - Temporal filters (data timestamp ranges, historical vs. real-time)
 * - Frequency filters (downsampling, rate limiting)  
 * - Compound filter conditions with AND/OR logic
 * - Performance-optimized filter execution
 */

import { TelemetryDataPoint, TelemetryDataType } from './TelemetryManager';

/**
 * Base filter interface that all filters must implement
 */
export interface TelemetryFilter {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: FilterType;
  evaluate(data: TelemetryDataPoint, context?: FilterContext): boolean;
  getConfiguration(): FilterConfiguration;
  setConfiguration(config: FilterConfiguration): void;
  reset?(): void;
  getStatistics?(): FilterStatistics;
}

/**
 * Filter types for different categories of filtering
 */
export enum FilterType {
  PROPERTY = 'property',       // Filter based on data properties
  TEMPORAL = 'temporal',       // Filter based on time
  FREQUENCY = 'frequency',     // Filter based on update frequency
  QUALITY = 'quality',         // Filter based on data quality
  COMPOUND = 'compound',       // Combines multiple filters
  CUSTOM = 'custom'           // User-defined custom filters
}

/**
 * Comparison operators for property filters
 */
export enum ComparisonOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'le',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'ge',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  MATCHES_REGEX = 'regex',
  IN_RANGE = 'in_range',
  NOT_IN_RANGE = 'not_in_range'
}

/**
 * Logical operators for compound filters
 */
export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not'
}

/**
 * Context information available during filter evaluation
 */
export interface FilterContext {
  channelId: string;
  dataType: TelemetryDataType;
  previousValue?: any;
  valueHistory?: TelemetryDataPoint[];
  streamStartTime: number;
  subscriptionConfig?: any;
  metadata?: Record<string, any>;
}

/**
 * Base configuration for all filters
 */
export interface FilterConfiguration {
  enabled: boolean;
  parameters: Record<string, any>;
  priority?: number;
  cacheable?: boolean;
  description?: string;
}

/**
 * Statistics for filter performance monitoring
 */
export interface FilterStatistics {
  evaluationCount: number;
  passCount: number;
  failCount: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  lastEvaluation: number;
  errorCount: number;
}

/**
 * Property-based filter for numeric, string, and boolean values
 */
export class PropertyFilter implements TelemetryFilter {
  public id: string;
  public name: string;
  public description: string;
  public enabled = true;
  public readonly type = FilterType.PROPERTY;

  private propertyPath: string;
  private operator: ComparisonOperator;
  private compareValue: any;
  private statistics: FilterStatistics;

  constructor(
    id: string,
    name: string,
    propertyPath: string,
    operator: ComparisonOperator,
    compareValue: any
  ) {
    this.id = id;
    this.name = name;
    this.description = `Filter ${propertyPath} ${operator} ${compareValue}`;
    this.propertyPath = propertyPath;
    this.operator = operator;
    this.compareValue = compareValue;
    
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  evaluate(data: TelemetryDataPoint, context?: FilterContext): boolean {
    if (!this.enabled) return true;

    const startTime = performance.now();
    let result = false;

    try {
      this.statistics.evaluationCount++;
      this.statistics.lastEvaluation = Date.now();

      const value = this.extractPropertyValue(data, this.propertyPath);
      result = this.compareValues(value, this.compareValue, this.operator);

      if (result) {
        this.statistics.passCount++;
      } else {
        this.statistics.failCount++;
      }

    } catch (error) {
      this.statistics.errorCount++;
      console.warn(`PropertyFilter ${this.id} evaluation error:`, error);
      result = false;
    }

    const executionTime = performance.now() - startTime;
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.evaluationCount;

    return result;
  }

  getConfiguration(): FilterConfiguration {
    return {
      enabled: this.enabled,
      parameters: {
        propertyPath: this.propertyPath,
        operator: this.operator,
        compareValue: this.compareValue
      }
    };
  }

  setConfiguration(config: FilterConfiguration): void {
    this.enabled = config.enabled;
    if (config.parameters.propertyPath) {
      this.propertyPath = config.parameters.propertyPath;
    }
    if (config.parameters.operator) {
      this.operator = config.parameters.operator;
    }
    if (config.parameters.compareValue !== undefined) {
      this.compareValue = config.parameters.compareValue;
    }
  }

  getStatistics(): FilterStatistics {
    return { ...this.statistics };
  }

  reset(): void {
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  private extractPropertyValue(data: TelemetryDataPoint, path: string): any {
    if (path === 'value') return data.value;
    if (path === 'timestamp') return data.timestamp;
    if (path === 'quality') return data.quality;

    // Handle nested property paths (e.g., "value.x", "metadata.sensor_id")
    const parts = path.split('.');
    let current: any = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  private compareValues(value: any, compareValue: any, operator: ComparisonOperator): boolean {
    if (value === undefined || value === null) {
      return operator === ComparisonOperator.NOT_EQUALS;
    }

    switch (operator) {
      case ComparisonOperator.EQUALS:
        return value === compareValue;
      
      case ComparisonOperator.NOT_EQUALS:
        return value !== compareValue;
      
      case ComparisonOperator.LESS_THAN:
        return value < compareValue;
      
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return value <= compareValue;
      
      case ComparisonOperator.GREATER_THAN:
        return value > compareValue;
      
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return value >= compareValue;
      
      case ComparisonOperator.CONTAINS:
        return String(value).includes(String(compareValue));
      
      case ComparisonOperator.STARTS_WITH:
        return String(value).startsWith(String(compareValue));
      
      case ComparisonOperator.ENDS_WITH:
        return String(value).endsWith(String(compareValue));
      
      case ComparisonOperator.MATCHES_REGEX:
        const regex = new RegExp(compareValue);
        return regex.test(String(value));
      
      case ComparisonOperator.IN_RANGE:
        if (Array.isArray(compareValue) && compareValue.length === 2) {
          return value >= compareValue[0] && value <= compareValue[1];
        }
        return false;
      
      case ComparisonOperator.NOT_IN_RANGE:
        if (Array.isArray(compareValue) && compareValue.length === 2) {
          return value < compareValue[0] || value > compareValue[1];
        }
        return true;
      
      default:
        return false;
    }
  }
}

/**
 * Temporal filter for time-based filtering
 */
export class TemporalFilter implements TelemetryFilter {
  public id: string;
  public name: string;
  public description: string;
  public enabled = true;
  public readonly type = FilterType.TEMPORAL;

  private startTime?: number;
  private endTime?: number;
  private maxAge?: number;        // Maximum age in milliseconds
  private minAge?: number;        // Minimum age in milliseconds
  private timeWindow?: number;    // Rolling time window
  private statistics: FilterStatistics;

  constructor(
    id: string,
    name: string,
    options: {
      startTime?: number;
      endTime?: number;
      maxAge?: number;
      minAge?: number;
      timeWindow?: number;
    }
  ) {
    this.id = id;
    this.name = name;
    this.startTime = options.startTime;
    this.endTime = options.endTime;
    this.maxAge = options.maxAge;
    this.minAge = options.minAge;
    this.timeWindow = options.timeWindow;
    
    this.description = this.buildDescription();
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  evaluate(data: TelemetryDataPoint, context?: FilterContext): boolean {
    if (!this.enabled) return true;

    const startTime = performance.now();
    let result = false;

    try {
      this.statistics.evaluationCount++;
      this.statistics.lastEvaluation = Date.now();

      const now = Date.now();
      const dataTime = data.timestamp;
      const age = now - dataTime;

      // Check absolute time range
      if (this.startTime !== undefined && dataTime < this.startTime) {
        result = false;
      } else if (this.endTime !== undefined && dataTime > this.endTime) {
        result = false;
      }
      // Check age constraints
      else if (this.maxAge !== undefined && age > this.maxAge) {
        result = false;
      } else if (this.minAge !== undefined && age < this.minAge) {
        result = false;
      }
      // Check time window (rolling window from now)
      else if (this.timeWindow !== undefined && age > this.timeWindow) {
        result = false;
      } else {
        result = true;
      }

      if (result) {
        this.statistics.passCount++;
      } else {
        this.statistics.failCount++;
      }

    } catch (error) {
      this.statistics.errorCount++;
      console.warn(`TemporalFilter ${this.id} evaluation error:`, error);
      result = false;
    }

    const executionTime = performance.now() - startTime;
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.evaluationCount;

    return result;
  }

  getConfiguration(): FilterConfiguration {
    return {
      enabled: this.enabled,
      parameters: {
        startTime: this.startTime,
        endTime: this.endTime,
        maxAge: this.maxAge,
        minAge: this.minAge,
        timeWindow: this.timeWindow
      }
    };
  }

  setConfiguration(config: FilterConfiguration): void {
    this.enabled = config.enabled;
    this.startTime = config.parameters.startTime;
    this.endTime = config.parameters.endTime;
    this.maxAge = config.parameters.maxAge;
    this.minAge = config.parameters.minAge;
    this.timeWindow = config.parameters.timeWindow;
    this.description = this.buildDescription();
  }

  getStatistics(): FilterStatistics {
    return { ...this.statistics };
  }

  reset(): void {
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  private buildDescription(): string {
    const parts: string[] = [];
    
    if (this.startTime) {
      parts.push(`after ${new Date(this.startTime).toISOString()}`);
    }
    if (this.endTime) {
      parts.push(`before ${new Date(this.endTime).toISOString()}`);
    }
    if (this.maxAge) {
      parts.push(`max age ${this.maxAge}ms`);
    }
    if (this.minAge) {
      parts.push(`min age ${this.minAge}ms`);
    }
    if (this.timeWindow) {
      parts.push(`within ${this.timeWindow}ms window`);
    }

    return parts.length > 0 ? `Temporal filter: ${parts.join(', ')}` : 'Temporal filter';
  }
}

/**
 * Frequency filter for rate limiting and downsampling
 */
export class FrequencyFilter implements TelemetryFilter {
  public id: string;
  public name: string;
  public description: string;
  public enabled = true;  
  public readonly type = FilterType.FREQUENCY;

  private maxFrequency: number;        // Maximum allowed frequency (Hz)
  private minInterval: number;         // Minimum interval between samples (ms)
  private lastPassTime = 0;
  private decimationFactor?: number;   // Keep 1 out of N samples
  private decimationCounter = 0;
  private statistics: FilterStatistics;

  constructor(
    id: string,
    name: string,
    options: {
      maxFrequency?: number;
      decimationFactor?: number;
    }
  ) {
    this.id = id;
    this.name = name;
    this.maxFrequency = options.maxFrequency || 100;
    this.minInterval = 1000 / this.maxFrequency;
    this.decimationFactor = options.decimationFactor;
    
    this.description = `Frequency filter: max ${this.maxFrequency}Hz` +
      (this.decimationFactor ? `, decimation 1:${this.decimationFactor}` : '');
    
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  evaluate(data: TelemetryDataPoint, context?: FilterContext): boolean {
    if (!this.enabled) return true;

    const startTime = performance.now();
    let result = false;

    try {
      this.statistics.evaluationCount++;
      this.statistics.lastEvaluation = Date.now();

      // Apply decimation if configured
      if (this.decimationFactor && this.decimationFactor > 1) {
        this.decimationCounter++;
        if (this.decimationCounter % this.decimationFactor !== 0) {
          result = false;
        } else {
          result = true;
        }
      } else {
        // Apply frequency limiting
        const now = data.timestamp;
        const timeSinceLastPass = now - this.lastPassTime;
        
        if (timeSinceLastPass >= this.minInterval) {
          this.lastPassTime = now;
          result = true;
        } else {
          result = false;
        }
      }

      if (result) {
        this.statistics.passCount++;
      } else {
        this.statistics.failCount++;
      }

    } catch (error) {
      this.statistics.errorCount++;
      console.warn(`FrequencyFilter ${this.id} evaluation error:`, error);
      result = false;
    }

    const executionTime = performance.now() - startTime;
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.evaluationCount;

    return result;
  }

  getConfiguration(): FilterConfiguration {
    return {
      enabled: this.enabled,
      parameters: {
        maxFrequency: this.maxFrequency,
        decimationFactor: this.decimationFactor
      }
    };
  }

  setConfiguration(config: FilterConfiguration): void {
    this.enabled = config.enabled;
    if (config.parameters.maxFrequency) {
      this.maxFrequency = config.parameters.maxFrequency;
      this.minInterval = 1000 / this.maxFrequency;
    }
    if (config.parameters.decimationFactor) {
      this.decimationFactor = config.parameters.decimationFactor;
    }
  }

  getStatistics(): FilterStatistics {
    return { ...this.statistics };
  }

  reset(): void {
    this.lastPassTime = 0;
    this.decimationCounter = 0;
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }
}

/**
 * Quality filter for data quality thresholds
 */
export class QualityFilter implements TelemetryFilter {
  public id: string;
  public name: string;
  public description: string;
  public enabled = true;
  public readonly type = FilterType.QUALITY;

  private minQuality: number;
  private requireQualityField: boolean;
  private statistics: FilterStatistics;

  constructor(
    id: string,
    name: string,
    minQuality: number = 0.5,
    requireQualityField: boolean = false
  ) {
    this.id = id;
    this.name = name;
    this.minQuality = minQuality;
    this.requireQualityField = requireQualityField;
    this.description = `Quality filter: min quality ${minQuality}`;
    
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  evaluate(data: TelemetryDataPoint, context?: FilterContext): boolean {
    if (!this.enabled) return true;

    const startTime = performance.now();
    let result = false;

    try {
      this.statistics.evaluationCount++;
      this.statistics.lastEvaluation = Date.now();

      if (this.requireQualityField && data.quality === undefined) {
        result = false;
      } else if (data.quality !== undefined) {
        result = data.quality >= this.minQuality;
      } else {
        // If quality not provided and not required, pass through
        result = true;
      }

      if (result) {
        this.statistics.passCount++;
      } else {
        this.statistics.failCount++;
      }

    } catch (error) {
      this.statistics.errorCount++;
      console.warn(`QualityFilter ${this.id} evaluation error:`, error);
      result = false;
    }

    const executionTime = performance.now() - startTime;
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.evaluationCount;

    return result;
  }

  getConfiguration(): FilterConfiguration {
    return {
      enabled: this.enabled,
      parameters: {
        minQuality: this.minQuality,
        requireQualityField: this.requireQualityField
      }
    };
  }

  setConfiguration(config: FilterConfiguration): void {
    this.enabled = config.enabled;
    this.minQuality = config.parameters.minQuality || 0.5;
    this.requireQualityField = config.parameters.requireQualityField || false;
  }

  getStatistics(): FilterStatistics {
    return { ...this.statistics };
  }

  reset(): void {
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }
}

/**
 * Compound filter that combines multiple filters with logical operators
 */
export class CompoundFilter implements TelemetryFilter {
  public id: string;
  public name: string;
  public description: string;
  public enabled = true;
  public readonly type = FilterType.COMPOUND;

  private filters: TelemetryFilter[] = [];
  private operator: LogicalOperator;
  private statistics: FilterStatistics;

  constructor(
    id: string,
    name: string,
    operator: LogicalOperator = LogicalOperator.AND,
    filters: TelemetryFilter[] = []
  ) {
    this.id = id;
    this.name = name;
    this.operator = operator;
    this.filters = filters;
    this.description = `Compound filter: ${operator} of ${filters.length} filters`;
    
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  evaluate(data: TelemetryDataPoint, context?: FilterContext): boolean {
    if (!this.enabled) return true;

    const startTime = performance.now();
    let result = false;

    try {
      this.statistics.evaluationCount++;
      this.statistics.lastEvaluation = Date.now();

      if (this.filters.length === 0) {
        result = true;
      } else {
        switch (this.operator) {
          case LogicalOperator.AND:
            result = this.filters.every(filter => filter.evaluate(data, context));
            break;
          
          case LogicalOperator.OR:
            result = this.filters.some(filter => filter.evaluate(data, context));
            break;
          
          case LogicalOperator.NOT:
            // For NOT, evaluate the first filter and negate
            result = this.filters.length > 0 ? !this.filters[0].evaluate(data, context) : true;
            break;
        }
      }

      if (result) {
        this.statistics.passCount++;
      } else {
        this.statistics.failCount++;
      }

    } catch (error) {
      this.statistics.errorCount++;
      console.warn(`CompoundFilter ${this.id} evaluation error:`, error);
      result = false;
    }

    const executionTime = performance.now() - startTime;
    this.statistics.totalExecutionTime += executionTime;
    this.statistics.averageExecutionTime = 
      this.statistics.totalExecutionTime / this.statistics.evaluationCount;

    return result;
  }

  addFilter(filter: TelemetryFilter): void {
    this.filters.push(filter);
    this.description = `Compound filter: ${this.operator} of ${this.filters.length} filters`;
  }

  removeFilter(filterId: string): boolean {
    const index = this.filters.findIndex(f => f.id === filterId);
    if (index >= 0) {
      this.filters.splice(index, 1);
      this.description = `Compound filter: ${this.operator} of ${this.filters.length} filters`;
      return true;
    }
    return false;
  }

  getFilters(): TelemetryFilter[] {
    return [...this.filters];
  }

  getConfiguration(): FilterConfiguration {
    return {
      enabled: this.enabled,
      parameters: {
        operator: this.operator,
        filters: this.filters.map(f => f.getConfiguration())
      }
    };
  }

  setConfiguration(config: FilterConfiguration): void {
    this.enabled = config.enabled;
    this.operator = config.parameters.operator || LogicalOperator.AND;
    // Note: Configuring child filters would require filter factory
  }

  getStatistics(): FilterStatistics {
    return { ...this.statistics };
  }

  reset(): void {
    this.filters.forEach(filter => filter.reset?.());
    this.statistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }
}

/**
 * Filter manager for managing multiple filters and filter chains
 */
export class FilterManager {
  private filters = new Map<string, TelemetryFilter>();
  private filterChains = new Map<string, TelemetryFilter[]>();
  private globalStatistics: FilterStatistics;

  constructor() {
    this.globalStatistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };
  }

  /**
   * Register a filter
   */
  registerFilter(filter: TelemetryFilter): void {
    this.filters.set(filter.id, filter);
  }

  /**
   * Remove a filter
   */
  removeFilter(filterId: string): boolean {
    return this.filters.delete(filterId);
  }

  /**
   * Get a filter by ID
   */
  getFilter(filterId: string): TelemetryFilter | undefined {
    return this.filters.get(filterId);
  }

  /**
   * Get all filters
   */
  getAllFilters(): TelemetryFilter[] {
    return Array.from(this.filters.values());
  }

  /**
   * Create a filter chain for a channel
   */
  createFilterChain(channelId: string, filterIds: string[]): void {
    const chain = filterIds
      .map(id => this.filters.get(id))
      .filter(f => f !== undefined) as TelemetryFilter[];
    
    this.filterChains.set(channelId, chain);
  }

  /**
   * Remove a filter chain
   */
  removeFilterChain(channelId: string): void {
    this.filterChains.delete(channelId);
  }

  /**
   * Apply filters to telemetry data
   */
  applyFilters(
    channelId: string, 
    data: TelemetryDataPoint, 
    context?: FilterContext
  ): boolean {
    const startTime = performance.now();
    
    try {
      this.globalStatistics.evaluationCount++;
      this.globalStatistics.lastEvaluation = Date.now();

      const chain = this.filterChains.get(channelId);
      if (!chain || chain.length === 0) {
        this.globalStatistics.passCount++;
        return true;
      }

      // Apply all filters in the chain
      const result = chain.every(filter => filter.evaluate(data, context));
      
      if (result) {
        this.globalStatistics.passCount++;
      } else {
        this.globalStatistics.failCount++;
      }

      return result;

    } catch (error) {
      this.globalStatistics.errorCount++;
      console.warn(`FilterManager evaluation error for channel ${channelId}:`, error);
      return false;
    } finally {
      const executionTime = performance.now() - startTime;
      this.globalStatistics.totalExecutionTime += executionTime;
      this.globalStatistics.averageExecutionTime = 
        this.globalStatistics.totalExecutionTime / this.globalStatistics.evaluationCount;
    }
  }

  /**
   * Get filter chain for a channel
   */
  getFilterChain(channelId: string): TelemetryFilter[] {
    return this.filterChains.get(channelId)?.slice() || [];
  }

  /**
   * Get global filter statistics
   */
  getGlobalStatistics(): FilterStatistics {
    return { ...this.globalStatistics };
  }

  /**
   * Get statistics for all filters
   */
  getAllFilterStatistics(): Map<string, FilterStatistics> {
    const stats = new Map<string, FilterStatistics>();
    for (const [id, filter] of this.filters) {
      if (filter.getStatistics) {
        stats.set(id, filter.getStatistics());
      }
    }
    return stats;
  }

  /**
   * Reset all filter statistics
   */
  resetAllStatistics(): void {
    this.globalStatistics = {
      evaluationCount: 0,
      passCount: 0,
      failCount: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      lastEvaluation: 0,
      errorCount: 0
    };

    this.filters.forEach(filter => filter.reset?.());
  }

  /**
   * Export filter configurations
   */
  exportConfigurations(): Record<string, FilterConfiguration> {
    const configs: Record<string, FilterConfiguration> = {};
    for (const [id, filter] of this.filters) {
      configs[id] = filter.getConfiguration();
    }
    return configs;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    global: FilterStatistics;
    byFilter: Map<string, FilterStatistics>;
    slowestFilters: Array<{ id: string; avgTime: number }>;
    mostUsedFilters: Array<{ id: string; evaluations: number }>;
  } {
    const byFilter = this.getAllFilterStatistics();
    
    const slowestFilters = Array.from(byFilter.entries())
      .map(([id, stats]) => ({ id, avgTime: stats.averageExecutionTime }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const mostUsedFilters = Array.from(byFilter.entries())
      .map(([id, stats]) => ({ id, evaluations: stats.evaluationCount }))
      .sort((a, b) => b.evaluations - a.evaluations)
      .slice(0, 10);

    return {
      global: this.globalStatistics,
      byFilter,
      slowestFilters,
      mostUsedFilters
    };
  }
}

/**
 * Factory for creating common filter types
 */
export class FilterFactory {
  /**
   * Create a numeric range filter
   */
  static createNumericRangeFilter(
    id: string,
    name: string,
    propertyPath: string,
    min: number,
    max: number
  ): PropertyFilter {
    return new PropertyFilter(
      id,
      name,
      propertyPath,
      ComparisonOperator.IN_RANGE,
      [min, max]
    );
  }

  /**
   * Create a string pattern filter
   */
  static createStringPatternFilter(
    id: string,
    name: string,
    propertyPath: string,
    pattern: string,
    operator: ComparisonOperator = ComparisonOperator.CONTAINS
  ): PropertyFilter {
    return new PropertyFilter(id, name, propertyPath, operator, pattern);
  }

  /**
   * Create a recent data filter (data within last N milliseconds)
   */
  static createRecentDataFilter(
    id: string,
    name: string,
    maxAge: number
  ): TemporalFilter {
    return new TemporalFilter(id, name, { maxAge });
  }

  /**
   * Create a rate limiting filter
   */
  static createRateLimitFilter(
    id: string,
    name: string,
    maxFrequency: number
  ): FrequencyFilter {
    return new FrequencyFilter(id, name, { maxFrequency });
  }

  /**
   * Create a decimation filter
   */
  static createDecimationFilter(
    id: string,
    name: string,
    decimationFactor: number
  ): FrequencyFilter {
    return new FrequencyFilter(id, name, { decimationFactor });
  }

  /**
   * Create a quality threshold filter
   */
  static createQualityThresholdFilter(
    id: string,
    name: string,
    minQuality: number
  ): QualityFilter {
    return new QualityFilter(id, name, minQuality, true);
  }
}