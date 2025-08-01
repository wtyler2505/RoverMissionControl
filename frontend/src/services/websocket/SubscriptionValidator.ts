/**
 * SubscriptionValidator - Server-side Validation and Permission Checking
 * 
 * Provides comprehensive validation including:
 * - Permission checking against RBAC system
 * - Resource utilization limits per user/client
 * - Validation of filter parameters against channel capabilities
 * - Subscription conflict resolution
 * - Rate limiting and quota enforcement
 */

import { ChannelRegistry, ChannelMetadata, ChannelPermissionLevel } from './ChannelRegistry';
import { SubscriptionRequest, SubscriptionResponse, SubscriptionStatusCode } from './SubscriptionProtocol';
import { TelemetryFilter, FilterConfiguration } from './TelemetryFilters';
import { Priority, Protocol } from './types';

/**
 * User context for validation
 */
export interface UserContext {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  rateLimits?: {
    maxSubscriptions: number;
    maxBandwidthMbps: number;
    maxRequestsPerMinute: number;
  };
  quotas?: {
    usedSubscriptions: number;
    usedBandwidthMbps: number;
    requestsThisMinute: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Validation context for subscription requests
 */
export interface ValidationContext {
  user: UserContext;
  channelRegistry: ChannelRegistry;
  existingSubscriptions: Map<string, SubscriptionRequest>;
  serverCapabilities: ServerCapabilities;
  timestamp: number;
}

/**
 * Server capabilities and limits
 */
export interface ServerCapabilities {
  maxConcurrentSubscriptions: number;
  maxSubscriptionsPerUser: number;
  maxChannelsPerSubscription: number;
  maxFrequencyHz: number;
  maxBatchSize: number;
  supportedProtocols: Protocol[];
  supportedFilters: string[];
  features: string[];
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxNetworkMbps: number;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  modifications?: Partial<SubscriptionRequest>;
  estimatedResourceUsage?: ResourceUsageEstimate;
}

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
  details?: Record<string, any>;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
  impact?: 'performance' | 'reliability' | 'cost';
}

/**
 * Resource usage estimation
 */
export interface ResourceUsageEstimate {
  memoryMB: number;
  cpuPercent: number;
  networkMbps: number;
  storageGB?: number;
  estimatedCost?: number;
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  name: string;
  priority: number;
  validate(request: SubscriptionRequest, context: ValidationContext): Promise<ValidationResult>;
}

/**
 * Permission validation rule
 */
export class PermissionValidationRule implements ValidationRule {
  name = 'permission';
  priority = 100; // High priority

  async validate(request: SubscriptionRequest, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Get channel metadata
    const channel = context.channelRegistry.getChannel(request.channelId);
    if (!channel) {
      result.valid = false;
      result.errors.push({
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel not found: ${request.channelId}`,
        field: 'channelId',
        severity: 'error'
      });
      return result;
    }

    // Check basic channel access permission
    const hasAccess = context.channelRegistry.checkChannelPermission(
      request.channelId,
      context.user.roles,
      context.user.permissions
    );

    if (!hasAccess) {
      result.valid = false;
      result.errors.push({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Insufficient permissions to access channel: ${request.channelId}`,
        field: 'channelId',
        severity: 'error',
        details: {
          requiredRoles: channel.permissions.requiredRoles,
          requiredPermissions: channel.permissions.requiredPermissions,
          userRoles: context.user.roles,
          userPermissions: context.user.permissions
        }
      });
      return result;
    }

    // Check rate limits if configured
    if (channel.permissions.rateLimits) {
      const rateLimits = channel.permissions.rateLimits;
      const userQuotas = context.user.quotas;

      if (userQuotas) {
        // Check subscription limit
        if (rateLimits.maxSubscriptions && 
            userQuotas.usedSubscriptions >= rateLimits.maxSubscriptions) {
          result.valid = false;
          result.errors.push({
            code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
            message: `Maximum subscriptions exceeded for channel: ${request.channelId}`,
            severity: 'error',
            details: {
              limit: rateLimits.maxSubscriptions,
              current: userQuotas.usedSubscriptions
            }
          });
        }

        // Check bandwidth limit
        if (rateLimits.maxBandwidthMbps && 
            userQuotas.usedBandwidthMbps >= rateLimits.maxBandwidthMbps) {
          result.valid = false;
          result.errors.push({
            code: 'BANDWIDTH_LIMIT_EXCEEDED',
            message: `Bandwidth limit exceeded for channel: ${request.channelId}`,
            severity: 'error',
            details: {
              limit: rateLimits.maxBandwidthMbps,
              current: userQuotas.usedBandwidthMbps
            }
          });
        }

        // Check request rate limit
        if (rateLimits.maxRequestsPerMinute && 
            userQuotas.requestsThisMinute >= rateLimits.maxRequestsPerMinute) {
          result.valid = false;
          result.errors.push({
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for channel: ${request.channelId}`,
            severity: 'error',
            details: {
              limit: rateLimits.maxRequestsPerMinute,
              current: userQuotas.requestsThisMinute
            }
          });
        }
      }
    }

    return result;
  }
}

/**
 * Resource validation rule
 */
export class ResourceValidationRule implements ValidationRule {
  name = 'resource';
  priority = 90;

  async validate(request: SubscriptionRequest, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Estimate resource usage
    const estimate = this.estimateResourceUsage(request, context);
    result.estimatedResourceUsage = estimate;

    // Check against server limits
    const limits = context.serverCapabilities.resourceLimits;

    if (estimate.memoryMB > limits.maxMemoryMB * 0.1) { // 10% of server memory per subscription
      result.warnings.push({
        code: 'HIGH_MEMORY_USAGE',
        message: `Subscription may consume significant memory: ${estimate.memoryMB}MB`,
        suggestion: 'Consider reducing buffer size or batch size',
        impact: 'performance'
      });

      if (estimate.memoryMB > limits.maxMemoryMB * 0.2) {
        result.valid = false;
        result.errors.push({
          code: 'MEMORY_LIMIT_EXCEEDED',
          message: `Estimated memory usage exceeds limits: ${estimate.memoryMB}MB`,
          severity: 'error',
          details: { estimate: estimate.memoryMB, limit: limits.maxMemoryMB * 0.2 }
        });
      }
    }

    if (estimate.cpuPercent > 10) { // 10% CPU per subscription
      result.warnings.push({
        code: 'HIGH_CPU_USAGE',
        message: `Subscription may consume significant CPU: ${estimate.cpuPercent}%`,
        suggestion: 'Consider reducing update frequency or simplifying filters',
        impact: 'performance'
      });

      if (estimate.cpuPercent > 25) {
        result.valid = false;
        result.errors.push({
          code: 'CPU_LIMIT_EXCEEDED',
          message: `Estimated CPU usage exceeds limits: ${estimate.cpuPercent}%`,
          severity: 'error',
          details: { estimate: estimate.cpuPercent, limit: 25 }
        });
      }
    }

    if (estimate.networkMbps > limits.maxNetworkMbps * 0.1) {
      result.warnings.push({
        code: 'HIGH_BANDWIDTH_USAGE',
        message: `Subscription may consume significant bandwidth: ${estimate.networkMbps}Mbps`,
        suggestion: 'Consider enabling compression or reducing update frequency',
        impact: 'cost'
      });
    }

    return result;
  }

  private estimateResourceUsage(request: SubscriptionRequest, context: ValidationContext): ResourceUsageEstimate {
    const channel = context.channelRegistry.getChannel(request.channelId);
    if (!channel) {
      return { memoryMB: 0, cpuPercent: 0, networkMbps: 0 };
    }

    // Estimate based on frequency and data size
    const frequency = request.frequency?.targetHz || channel.updateFrequency.typical;
    const batchSize = request.dataFormat.batchSize || 1;
    
    // Rough estimates - in production, these would be based on empirical data
    const bytesPerDataPoint = this.estimateDataPointSize(channel);
    const memoryPerPoint = bytesPerDataPoint * 2; // Account for processing overhead
    const bufferSize = request.qos.bufferSize || 1000;
    
    const memoryMB = (bufferSize * memoryPerPoint) / (1024 * 1024);
    const cpuPercent = Math.min(frequency * 0.01, 50); // 0.01% CPU per Hz, max 50%
    const networkMbps = (frequency * bytesPerDataPoint * 8) / (1024 * 1024); // bits per second to Mbps

    return {
      memoryMB: Math.round(memoryMB * 100) / 100,
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      networkMbps: Math.round(networkMbps * 100) / 100
    };
  }

  private estimateDataPointSize(channel: ChannelMetadata): number {
    // Estimate data point size based on channel type and format
    let baseSize = 50; // Base JSON overhead

    switch (channel.dataType) {
      case 'numeric':
        baseSize += 8; // 8 bytes for number
        break;
      case 'vector':
        const cols = channel.format.dimensions?.cols || 3;
        baseSize += cols * 8; // 8 bytes per number
        break;
      case 'matrix':
        const rows = channel.format.dimensions?.rows || 3;
        const matrixCols = channel.format.dimensions?.cols || 3;
        baseSize += rows * matrixCols * 8;
        break;
      case 'string':
        baseSize += 100; // Assume average string length
        break;
      case 'boolean':
        baseSize += 1;
        break;
      case 'object':
        baseSize += 200; // Assume complex object
        break;
    }

    return baseSize;
  }
}

/**
 * Channel compatibility validation rule
 */
export class ChannelCompatibilityRule implements ValidationRule {
  name = 'channel_compatibility';
  priority = 80;

  async validate(request: SubscriptionRequest, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      modifications: {}
    };

    const channel = context.channelRegistry.getChannel(request.channelId);
    if (!channel) {
      return result; // Channel existence already validated by permission rule
    }

    // Validate protocol compatibility
    if (!channel.transport.supportedProtocols.includes(request.dataFormat.protocol)) {
      // Try to use preferred protocol instead
      if (channel.transport.supportedProtocols.length > 0) {
        result.warnings.push({
          code: 'PROTOCOL_NOT_SUPPORTED',
          message: `Protocol ${request.dataFormat.protocol} not supported by channel, using ${channel.transport.preferredProtocol}`,
          suggestion: `Use one of: ${channel.transport.supportedProtocols.join(', ')}`
        });
        
        result.modifications = {
          dataFormat: {
            ...request.dataFormat,
            protocol: channel.transport.preferredProtocol
          }
        };
      } else {
        result.valid = false;
        result.errors.push({
          code: 'NO_COMPATIBLE_PROTOCOL',
          message: `No compatible protocol found for channel: ${request.channelId}`,
          severity: 'error'
        });
      }
    }

    // Validate frequency constraints
    const requestedFreq = request.frequency?.targetHz || 1;
    const channelFreq = channel.updateFrequency;

    if (requestedFreq > channelFreq.max) {
      if (channelFreq.adaptive) {
        result.warnings.push({
          code: 'FREQUENCY_CAPPED',
          message: `Requested frequency ${requestedFreq}Hz capped to channel maximum ${channelFreq.max}Hz`,
          impact: 'performance'
        });
        
        result.modifications = {
          ...result.modifications,
          frequency: {
            ...request.frequency,
            targetHz: channelFreq.max
          }
        };
      } else {
        result.valid = false;
        result.errors.push({
          code: 'FREQUENCY_TOO_HIGH',
          message: `Requested frequency ${requestedFreq}Hz exceeds channel maximum ${channelFreq.max}Hz`,
          severity: 'error'
        });
      }
    }

    if (requestedFreq < channelFreq.min) {
      result.warnings.push({
        code: 'FREQUENCY_TOO_LOW',
        message: `Requested frequency ${requestedFreq}Hz below channel minimum ${channelFreq.min}Hz`,
        suggestion: `Increase frequency to at least ${channelFreq.min}Hz for optimal performance`
      });
    }

    // Validate batch size
    const batchSize = request.dataFormat.batchSize;
    if (batchSize && batchSize > context.serverCapabilities.maxBatchSize) {
      result.modifications = {
        ...result.modifications,
        dataFormat: {
          ...request.dataFormat,
          batchSize: context.serverCapabilities.maxBatchSize
        }
      };
      
      result.warnings.push({
        code: 'BATCH_SIZE_REDUCED',
        message: `Batch size reduced from ${batchSize} to ${context.serverCapabilities.maxBatchSize}`,
        impact: 'performance'
      });
    }

    return result;
  }
}

/**
 * Filter validation rule
 */
export class FilterValidationRule implements ValidationRule {
  name = 'filter_validation';
  priority = 70;

  async validate(request: SubscriptionRequest, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!request.filters || request.filters.length === 0) {
      return result; // No filters to validate
    }

    const channel = context.channelRegistry.getChannel(request.channelId);
    if (!channel) {
      return result; // Channel existence already validated
    }

    for (const filter of request.filters) {
      // Validate filter type is supported
      if (!context.serverCapabilities.supportedFilters.includes(filter.type)) {
        result.errors.push({
          code: 'FILTER_TYPE_NOT_SUPPORTED',
          message: `Filter type '${filter.type}' not supported`,
          field: 'filters',
          severity: 'error',
          details: { filterId: filter.id, supportedTypes: context.serverCapabilities.supportedFilters }
        });
        result.valid = false;
        continue;
      }

      // Validate filter parameters
      const filterValidation = this.validateFilterParameters(filter, channel);
      if (!filterValidation.valid) {
        result.errors.push(...filterValidation.errors);
        result.valid = false;
      }
      result.warnings.push(...filterValidation.warnings);
    }

    // Check for conflicting filters
    const conflicts = this.detectFilterConflicts(request.filters);
    if (conflicts.length > 0) {
      result.warnings.push({
        code: 'CONFLICTING_FILTERS',
        message: `Detected conflicting filters: ${conflicts.join(', ')}`,
        suggestion: 'Review filter configuration to avoid conflicts',
        impact: 'reliability'
      });
    }

    return result;
  }

  private validateFilterParameters(filter: any, channel: ChannelMetadata): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    switch (filter.type) {
      case 'property':
        // Validate property path exists for channel data type
        if (filter.parameters.propertyPath) {
          const isValidPath = this.validatePropertyPath(filter.parameters.propertyPath, channel);
          if (!isValidPath) {
            result.warnings.push({
              code: 'INVALID_PROPERTY_PATH',
              message: `Property path '${filter.parameters.propertyPath}' may not exist for channel data type`,
              suggestion: 'Verify property path matches channel data structure'
            });
          }
        }
        break;

      case 'frequency':
        // Validate frequency parameters
        if (filter.parameters.maxFrequency) {
          const maxFreq = filter.parameters.maxFrequency;
          if (maxFreq > channel.updateFrequency.max) {
            result.warnings.push({
              code: 'FILTER_FREQUENCY_TOO_HIGH',
              message: `Filter max frequency ${maxFreq}Hz exceeds channel maximum ${channel.updateFrequency.max}Hz`,
              suggestion: `Reduce to ${channel.updateFrequency.max}Hz or lower`
            });
          }
        }
        break;

      case 'temporal':
        // Validate temporal parameters
        if (filter.parameters.startTime && filter.parameters.endTime) {
          if (filter.parameters.startTime >= filter.parameters.endTime) {
            result.errors.push({
              code: 'INVALID_TIME_RANGE',
              message: 'Start time must be before end time',
              severity: 'error'
            });
            result.valid = false;
          }
        }
        break;
    }

    return result;
  }

  private validatePropertyPath(path: string, channel: ChannelMetadata): boolean {
    // Basic validation - in production, this would be more sophisticated
    // based on the channel's schema or known data structure
    const commonPaths = ['value', 'timestamp', 'quality', 'metadata'];
    const pathParts = path.split('.');
    
    if (commonPaths.includes(pathParts[0])) {
      return true;
    }

    // Check against channel schema if available
    if (channel.format.schema) {
      // Would validate against JSON schema here
      return true;
    }

    // For complex data types, allow nested paths
    if (channel.dataType === 'object' && pathParts.length > 1) {
      return true;
    }

    return false;
  }

  private detectFilterConflicts(filters: any[]): string[] {
    const conflicts: string[] = [];
    
    // Check for conflicting frequency filters
    const frequencyFilters = filters.filter(f => f.type === 'frequency');
    if (frequencyFilters.length > 1) {
      conflicts.push('multiple frequency filters');
    }

    // Check for conflicting temporal filters
    const temporalFilters = filters.filter(f => f.type === 'temporal');
    if (temporalFilters.length > 1) {
      // Check if time ranges overlap or conflict
      for (let i = 0; i < temporalFilters.length - 1; i++) {
        for (let j = i + 1; j < temporalFilters.length; j++) {
          const filter1 = temporalFilters[i];
          const filter2 = temporalFilters[j];
          
          if (this.temporalFiltersConflict(filter1.parameters, filter2.parameters)) {
            conflicts.push(`temporal filters ${filter1.id} and ${filter2.id}`);
          }
        }
      }
    }

    return conflicts;
  }

  private temporalFiltersConflict(params1: any, params2: any): boolean {
    // Simple conflict detection - would be more sophisticated in production
    if (params1.startTime && params2.endTime && params1.startTime > params2.endTime) {
      return true;
    }
    if (params2.startTime && params1.endTime && params2.startTime > params1.endTime) {
      return true;
    }
    return false;
  }
}

/**
 * Subscription conflict validation rule
 */
export class SubscriptionConflictRule implements ValidationRule {
  name = 'subscription_conflict';
  priority = 60;

  async validate(request: SubscriptionRequest, context: ValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check for duplicate subscriptions
    const existingSubscription = Array.from(context.existingSubscriptions.values())
      .find(sub => 
        sub.channelId === request.channelId && 
        this.subscriptionsEquivalent(sub, request)
      );

    if (existingSubscription) {
      result.warnings.push({
        code: 'DUPLICATE_SUBSCRIPTION',
        message: `Similar subscription already exists for channel: ${request.channelId}`,
        suggestion: 'Consider modifying existing subscription instead of creating new one',
        impact: 'cost'
      });
    }

    // Check for resource conflicts
    const totalSubscriptions = context.existingSubscriptions.size;
    if (totalSubscriptions >= context.serverCapabilities.maxConcurrentSubscriptions) {
      result.valid = false;
      result.errors.push({
        code: 'MAX_SUBSCRIPTIONS_EXCEEDED',
        message: `Server maximum concurrent subscriptions exceeded: ${totalSubscriptions}`,
        severity: 'error'
      });
    }

    const userSubscriptions = Array.from(context.existingSubscriptions.values())
      .filter(sub => sub.options?.debugging?.logLevel !== undefined); // Crude way to identify user subscriptions
    
    if (userSubscriptions.length >= context.serverCapabilities.maxSubscriptionsPerUser) {
      result.valid = false;
      result.errors.push({
        code: 'USER_SUBSCRIPTION_LIMIT_EXCEEDED',
        message: `User subscription limit exceeded: ${userSubscriptions.length}`,
        severity: 'error'
      });
    }

    return result;
  }

  private subscriptionsEquivalent(sub1: SubscriptionRequest, sub2: SubscriptionRequest): boolean {
    // Simple equivalence check - would be more sophisticated in production
    return (
      sub1.channelId === sub2.channelId &&
      sub1.frequency?.targetHz === sub2.frequency?.targetHz &&
      sub1.dataFormat.protocol === sub2.dataFormat.protocol
    );
  }
}

/**
 * Main subscription validator that orchestrates all validation rules
 */
export class SubscriptionValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    // Register default validation rules in priority order
    this.rules = [
      new PermissionValidationRule(),
      new ResourceValidationRule(),
      new ChannelCompatibilityRule(),
      new FilterValidationRule(),
      new SubscriptionConflictRule()
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add a custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a validation rule
   */
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
  }

  /**
   * Validate a subscription request
   */
  async validateSubscription(
    request: SubscriptionRequest,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const aggregatedResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      modifications: {},
      estimatedResourceUsage: { memoryMB: 0, cpuPercent: 0, networkMbps: 0 }
    };

    // Run all validation rules
    for (const rule of this.rules) {
      try {
        const ruleResult = await rule.validate(request, context);
        
        // Aggregate results
        if (!ruleResult.valid) {
          aggregatedResult.valid = false;
        }
        
        aggregatedResult.errors.push(...ruleResult.errors);
        aggregatedResult.warnings.push(...ruleResult.warnings);
        
        // Merge modifications
        if (ruleResult.modifications) {
          this.mergeModifications(aggregatedResult.modifications!, ruleResult.modifications);
        }
        
        // Update resource estimates
        if (ruleResult.estimatedResourceUsage) {
          this.mergeResourceEstimates(
            aggregatedResult.estimatedResourceUsage!,
            ruleResult.estimatedResourceUsage
          );
        }

      } catch (error) {
        console.error(`Validation rule ${rule.name} failed:`, error);
        aggregatedResult.errors.push({
          code: 'VALIDATION_RULE_ERROR',
          message: `Internal validation error in rule: ${rule.name}`,
          severity: 'error',
          details: { rule: rule.name, error: String(error) }
        });
        aggregatedResult.valid = false;
      }
    }

    return aggregatedResult;
  }

  /**
   * Create subscription response from validation result
   */
  createSubscriptionResponse(
    requestId: string,
    subscriptionId: string,
    validationResult: ValidationResult,
    grantedConfig?: Partial<SubscriptionRequest>
  ): SubscriptionResponse {
    const response: SubscriptionResponse = {
      requestId,
      subscriptionId,
      status: {
        code: validationResult.valid ? SubscriptionStatusCode.SUCCESS : SubscriptionStatusCode.BAD_REQUEST,
        message: validationResult.valid ? 'Subscription validated successfully' : 'Validation failed'
      }
    };

    if (validationResult.valid && grantedConfig) {
      // Include granted configuration
      response.granted = {
        channelId: grantedConfig.channelId!,
        channelMetadata: {} as ChannelMetadata, // Would be populated with actual metadata
        dataFormat: grantedConfig.dataFormat!,
        frequency: {
          actualHz: grantedConfig.frequency?.targetHz || 1,
          guaranteedHz: grantedConfig.frequency?.minHz || 0.1,
          adaptive: grantedConfig.frequency?.adaptive || false
        },
        qos: grantedConfig.qos!,
        lifetime: {
          expiresAt: Date.now() + (grantedConfig.lifetime?.ttl || 3600) * 1000,
          renewalRequired: grantedConfig.lifetime?.autoRenew || false
        },
        appliedFilters: grantedConfig.filters || []
      };
    }

    if (validationResult.errors.length > 0) {
      response.status.details = {
        errors: validationResult.errors
      };
    }

    if (validationResult.warnings.length > 0) {
      response.warnings = validationResult.warnings.map(w => ({
        code: w.code,
        message: w.message,
        severity: w.impact === 'performance' ? 'warning' : 'info'
      }));
    }

    return response;
  }

  private mergeModifications(target: Partial<SubscriptionRequest>, source: Partial<SubscriptionRequest>): void {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        target[key as keyof SubscriptionRequest] = {
          ...(target[key as keyof SubscriptionRequest] as any || {}),
          ...value
        };
      } else {
        (target as any)[key] = value;
      }
    }
  }

  private mergeResourceEstimates(target: ResourceUsageEstimate, source: ResourceUsageEstimate): void {
    target.memoryMB = Math.max(target.memoryMB, source.memoryMB);
    target.cpuPercent = Math.max(target.cpuPercent, source.cpuPercent);
    target.networkMbps = Math.max(target.networkMbps, source.networkMbps);
    
    if (source.storageGB) {
      target.storageGB = Math.max(target.storageGB || 0, source.storageGB);
    }
    
    if (source.estimatedCost) {
      target.estimatedCost = (target.estimatedCost || 0) + source.estimatedCost;
    }
  }
}