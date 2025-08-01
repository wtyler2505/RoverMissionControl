/**
 * EnhancedTelemetryManager - Advanced Multi-Channel Subscription Management
 * 
 * Extends the base TelemetryManager with advanced subscription capabilities:
 * - Multi-channel subscription management with hierarchical organization
 * - Batch subscription requests with transactional support
 * - Cross-channel dependency handling and resolution
 * - Efficient internal routing of telemetry data to multiple subscribers
 * - Advanced filtering and subscription lifecycle management
 * - Performance monitoring and optimization
 */

import { TelemetryManager, TelemetryStreamConfig, TelemetryDataPoint, StreamSubscription } from './TelemetryManager';
import { ChannelRegistry, ChannelMetadata, ChannelCategory } from './ChannelRegistry';
import { FilterManager, TelemetryFilter } from './TelemetryFilters';
import { 
  SubscriptionRequest, 
  SubscriptionResponse, 
  SubscriptionMessageType,
  SubscriptionStatusCode,
  BatchSubscriptionRequest,
  BatchSubscriptionResponse,
  SubscriptionMessageBuilder,
  SubscriptionValidator as ProtocolValidator
} from './SubscriptionProtocol';
import { 
  SubscriptionValidator,
  UserContext,
  ValidationContext,
  ServerCapabilities
} from './SubscriptionValidator';
import { WebSocketClient } from './WebSocketClient';
import { EventEmitter } from './EventEmitter';
import { Priority, Protocol, MessageType } from './types';

/**
 * Enhanced subscription with full metadata and management
 */
export interface EnhancedSubscription extends StreamSubscription {
  // Extended properties
  channelMetadata: ChannelMetadata;
  filters: TelemetryFilter[];
  dependencies: string[];         // Other subscription IDs this depends on
  dependents: string[];          // Subscription IDs that depend on this
  groupId?: string;              // Subscription group for batch operations
  parentId?: string;             // Parent subscription for hierarchical organization
  children: string[];            // Child subscription IDs
  
  // Performance and monitoring
  metrics: {
    dataPointsReceived: number;
    dataPointsFiltered: number;
    averageLatency: number;
    throughputHz: number;
    errorCount: number;
    lastError?: Error;
    uptime: number;
    resourceUsage: {
      memoryMB: number;
      cpuPercent: number;
      networkMbps: number;
    };
  };
  
  // QoS and delivery
  qos: {
    reliability: 'at-most-once' | 'at-least-once' | 'exactly-once';
    ordered: boolean;
    durability: boolean;
    latencyTarget: number;
    bufferSize: number;
  };
  
  // Lifecycle management
  lifecycle: {
    expiresAt?: number;
    autoRenew: boolean;
    renewInterval?: number;
    lastRenewal?: number;
  };
}

/**
 * Subscription group for batch management
 */
export interface SubscriptionGroup {
  id: string;
  name: string;
  description?: string;
  subscriptionIds: string[];
  status: 'active' | 'paused' | 'error' | 'mixed';
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

/**
 * Cross-channel dependency definition
 */
export interface ChannelDependency {
  dependentChannel: string;
  requiredChannel: string;
  dependencyType: 'hard' | 'soft';    // Hard = must be available, Soft = preferred
  condition?: {
    filter: TelemetryFilter;
    action: 'enable' | 'disable' | 'modify';
  };
}

/**
 * Enhanced telemetry manager events
 */
export interface EnhancedTelemetryManagerEvents {
  // Subscription events
  'subscription:created': (subscription: EnhancedSubscription) => void;
  'subscription:modified': (subscription: EnhancedSubscription, changes: Partial<EnhancedSubscription>) => void;
  'subscription:destroyed': (subscriptionId: string) => void;
  'subscription:expired': (subscriptionId: string) => void;
  'subscription:renewed': (subscriptionId: string) => void;
  
  // Group events
  'group:created': (group: SubscriptionGroup) => void;
  'group:modified': (group: SubscriptionGroup) => void;
  'group:destroyed': (groupId: string) => void;
  
  // Dependency events
  'dependency:resolved': (dependentId: string, requiredId: string) => void;
  'dependency:failed': (dependentId: string, requiredId: string, reason: string) => void;
  
  // Data routing events
  'data:routed': (channelId: string, subscriberCount: number, latency: number) => void;
  'data:filtered': (subscriptionId: string, originalCount: number, filteredCount: number) => void;
  
  // Performance events
  'performance:degraded': (subscriptionId: string, metrics: any) => void;
  'performance:recovered': (subscriptionId: string, metrics: any) => void;
  
  // Error events
  'error:subscription': (subscriptionId: string, error: Error) => void;
  'error:dependency': (dependencyChain: string[], error: Error) => void;
  'error:routing': (channelId: string, error: Error) => void;
}

/**
 * Enhanced Telemetry Manager with advanced subscription capabilities
 */
export class EnhancedTelemetryManager extends EventEmitter<EnhancedTelemetryManagerEvents> {
  private baseTelemetryManager: TelemetryManager;
  private channelRegistry: ChannelRegistry;
  private filterManager: FilterManager;
  private subscriptionValidator: SubscriptionValidator;
  
  // Enhanced subscription management
  private enhancedSubscriptions = new Map<string, EnhancedSubscription>();
  private subscriptionGroups = new Map<string, SubscriptionGroup>();
  private channelDependencies = new Map<string, ChannelDependency[]>();
  private dataRoutingTable = new Map<string, Set<string>>(); // channelId -> subscriptionIds
  
  // Performance monitoring
  private performanceMonitoringInterval?: NodeJS.Timeout;
  private routingMetrics = new Map<string, {
    subscriberCount: number;
    averageLatency: number;
    throughput: number;
    lastUpdate: number;
  }>();
  
  // Configuration
  private serverCapabilities: ServerCapabilities;
  private userContext: UserContext;

  constructor(
    wsClient: WebSocketClient,
    channelRegistry: ChannelRegistry,
    userContext: UserContext,
    serverCapabilities?: Partial<ServerCapabilities>
  ) {
    super();
    
    this.baseTelemetryManager = new TelemetryManager(wsClient);
    this.channelRegistry = channelRegistry;
    this.filterManager = new FilterManager();
    this.subscriptionValidator = new SubscriptionValidator();
    this.userContext = userContext;
    
    // Default server capabilities
    this.serverCapabilities = {
      maxConcurrentSubscriptions: 1000,
      maxSubscriptionsPerUser: 100,
      maxChannelsPerSubscription: 1,
      maxFrequencyHz: 1000,
      maxBatchSize: 10000,
      supportedProtocols: [Protocol.JSON, Protocol.MESSAGEPACK, Protocol.CBOR],
      supportedFilters: ['property', 'temporal', 'frequency', 'quality', 'compound'],
      features: ['batch_subscriptions', 'dependencies', 'groups', 'filtering'],
      resourceLimits: {
        maxMemoryMB: 1024,
        maxCpuPercent: 50,
        maxNetworkMbps: 100
      },
      ...serverCapabilities
    };
    
    this.setupEventHandlers();
    this.startPerformanceMonitoring();
  }

  /**
   * Create an enhanced subscription with full validation and features
   */
  async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const subscriptionId = request.subscriptionId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate the subscription request
      const validationContext: ValidationContext = {
        user: this.userContext,
        channelRegistry: this.channelRegistry,
        existingSubscriptions: this.getExistingSubscriptionsAsMap(),
        serverCapabilities: this.serverCapabilities,
        timestamp: Date.now()
      };

      const validationResult = await this.subscriptionValidator.validateSubscription(request, validationContext);
      
      if (!validationResult.valid) {
        return this.subscriptionValidator.createSubscriptionResponse(
          requestId,
          subscriptionId,
          validationResult
        );
      }

      // Apply any modifications from validation
      const finalRequest: SubscriptionRequest = {
        ...request,
        ...validationResult.modifications
      };

      // Get channel metadata
      const channelMetadata = this.channelRegistry.getChannel(request.channelId);
      if (!channelMetadata) {
        throw new Error(`Channel not found: ${request.channelId}`);
      }

      // Create telemetry stream config
      const streamConfig: TelemetryStreamConfig = this.createStreamConfig(finalRequest, channelMetadata);
      
      // Subscribe via base telemetry manager
      const baseSubscriptionId = await this.baseTelemetryManager.subscribe(streamConfig);
      
      // Create enhanced subscription
      const enhancedSubscription: EnhancedSubscription = {
        // Base subscription properties
        streamId: baseSubscriptionId,
        subscriptionId,
        config: streamConfig,
        active: true,
        paused: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        
        // Enhanced properties
        channelMetadata,
        filters: [],
        dependencies: finalRequest.options?.debugging ? [] : [], // Simple dependency resolution
        dependents: [],
        children: [],
        
        // Performance metrics
        metrics: {
          dataPointsReceived: 0,
          dataPointsFiltered: 0,
          averageLatency: 0,
          throughputHz: 0,
          errorCount: 0,
          uptime: 0,
          resourceUsage: {
            memoryMB: validationResult.estimatedResourceUsage?.memoryMB || 0,
            cpuPercent: validationResult.estimatedResourceUsage?.cpuPercent || 0,
            networkMbps: validationResult.estimatedResourceUsage?.networkMbps || 0
          }
        },
        
        // QoS configuration
        qos: {
          reliability: finalRequest.qos.reliability,
          ordered: finalRequest.qos.ordered || false,
          durability: finalRequest.qos.durability || false,
          latencyTarget: finalRequest.qos.latencyTarget || 100,
          bufferSize: finalRequest.qos.bufferSize || 1000
        },
        
        // Lifecycle management
        lifecycle: {
          expiresAt: finalRequest.lifetime?.expiresAt || 
                    (finalRequest.lifetime?.ttl ? Date.now() + finalRequest.lifetime.ttl * 1000 : undefined),
          autoRenew: finalRequest.lifetime?.autoRenew || false,
          renewInterval: finalRequest.lifetime?.renewInterval
        }
      };

      // Set up filters if provided
      if (finalRequest.filters) {
        enhancedSubscription.filters = await this.createFiltersFromSpecs(finalRequest.filters);
        this.filterManager.createFilterChain(
          request.channelId,
          enhancedSubscription.filters.map(f => f.id)
        );
      }

      // Store enhanced subscription
      this.enhancedSubscriptions.set(subscriptionId, enhancedSubscription);
      
      // Update data routing table
      this.updateDataRoutingTable(request.channelId, subscriptionId);
      
      // Handle dependencies
      await this.resolveDependencies(enhancedSubscription);
      
      // Emit creation event
      this.emit('subscription:created', enhancedSubscription);
      
      // Create successful response
      return this.subscriptionValidator.createSubscriptionResponse(
        requestId,
        subscriptionId,
        validationResult,
        finalRequest
      );

    } catch (error) {
      console.error(`Failed to create subscription ${subscriptionId}:`, error);
      
      return {
        requestId,
        subscriptionId,
        status: {
          code: SubscriptionStatusCode.INTERNAL_ERROR,
          message: `Failed to create subscription: ${error}`,
          details: { error: String(error) }
        }
      };
    }
  }

  /**
   * Create multiple subscriptions in a batch operation
   */
  async createBatchSubscriptions(request: BatchSubscriptionRequest): Promise<BatchSubscriptionResponse> {
    const results: BatchSubscriptionResponse['results'] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process subscriptions with optional concurrency limit
    const maxConcurrency = request.options?.maxConcurrency || 5;
    const chunks = this.chunkArray(request.subscriptions, maxConcurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (subscriptionRequest) => {
        try {
          const response = await this.createSubscription(subscriptionRequest);
          const result = {
            channelId: subscriptionRequest.channelId,
            subscriptionId: response.subscriptionId,
            status: response.status.code,
            response: response.status.code === SubscriptionStatusCode.SUCCESS ? response : undefined,
            error: response.status.code !== SubscriptionStatusCode.SUCCESS ? response.status.message : undefined
          };

          if (response.status.code === SubscriptionStatusCode.SUCCESS) {
            successCount++;
          } else {
            failureCount++;
            
            // If fail-on-any-error is enabled and we have a failure, cancel remaining
            if (request.options?.failOnAnyError) {
              throw new Error(`Batch subscription failed: ${response.status.message}`);
            }
          }

          return result;
        } catch (error) {
          failureCount++;
          return {
            channelId: subscriptionRequest.channelId,
            status: SubscriptionStatusCode.INTERNAL_ERROR,
            error: String(error)
          };
        }
      });

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      
      // If fail-on-any-error and we have failures, stop processing
      if (request.options?.failOnAnyError && failureCount > 0) {
        break;
      }
    }

    // If transactional and we have failures, rollback successful subscriptions
    if (request.options?.transactional && failureCount > 0) {
      const successfulIds = results
        .filter(r => r.status === SubscriptionStatusCode.SUCCESS)
        .map(r => r.subscriptionId)
        .filter((id): id is string => id !== undefined);
      
      await Promise.all(successfulIds.map(id => this.destroySubscription(id)));
      
      return {
        requestId: request.requestId,
        status: {
          code: SubscriptionStatusCode.BAD_REQUEST,
          message: 'Transactional batch failed - all subscriptions rolled back',
          successCount: 0,
          failureCount: request.subscriptions.length
        },
        results: request.subscriptions.map(sub => ({
          channelId: sub.channelId,
          status: SubscriptionStatusCode.BAD_REQUEST,
          error: 'Rolled back due to batch failure'
        }))
      };
    }

    return {
      requestId: request.requestId,
      status: {
        code: successCount > 0 ? 
          (failureCount === 0 ? SubscriptionStatusCode.SUCCESS : SubscriptionStatusCode.PARTIAL_SUCCESS) :
          SubscriptionStatusCode.BAD_REQUEST,
        message: `Batch completed: ${successCount} succeeded, ${failureCount} failed`,
        successCount,
        failureCount
      },
      results
    };
  }

  /**
   * Modify an existing subscription
   */
  async modifySubscription(
    subscriptionId: string, 
    modifications: Partial<SubscriptionRequest>
  ): Promise<SubscriptionResponse> {
    const subscription = this.enhancedSubscriptions.get(subscriptionId);
    if (!subscription) {
      return {
        requestId: `mod_${Date.now()}`,
        subscriptionId,
        status: {
          code: SubscriptionStatusCode.NOT_FOUND,
          message: `Subscription not found: ${subscriptionId}`
        }
      };
    }

    try {
      // Create a modified request for validation
      const modifiedRequest: SubscriptionRequest = this.subscriptionToRequest(subscription, modifications);
      
      // Validate modifications
      const validationContext: ValidationContext = {
        user: this.userContext,
        channelRegistry: this.channelRegistry,
        existingSubscriptions: this.getExistingSubscriptionsAsMap(),
        serverCapabilities: this.serverCapabilities,
        timestamp: Date.now()
      };

      const validationResult = await this.subscriptionValidator.validateSubscription(modifiedRequest, validationContext);
      
      if (!validationResult.valid) {
        return this.subscriptionValidator.createSubscriptionResponse(
          `mod_${Date.now()}`,
          subscriptionId,
          validationResult
        );
      }

      // Apply modifications
      const previousSubscription = { ...subscription };
      
      // Update filters if provided
      if (modifications.filters) {
        subscription.filters = await this.createFiltersFromSpecs(modifications.filters);
        this.filterManager.createFilterChain(
          subscription.channelMetadata.id,
          subscription.filters.map(f => f.id)
        );
      }

      // Update other properties as needed
      if (modifications.frequency) {
        // Update base telemetry manager config
        await this.baseTelemetryManager.updateStreamConfig(
          subscription.streamId,
          { sampleRate: modifications.frequency.targetHz }
        );
      }

      subscription.lastActivity = Date.now();
      
      this.emit('subscription:modified', subscription, modifications);
      
      return {
        requestId: `mod_${Date.now()}`,
        subscriptionId,
        status: {
          code: SubscriptionStatusCode.SUCCESS,
          message: 'Subscription modified successfully'
        }
      };

    } catch (error) {
      return {
        requestId: `mod_${Date.now()}`,
        subscriptionId,
        status: {
          code: SubscriptionStatusCode.INTERNAL_ERROR,
          message: `Failed to modify subscription: ${error}`
        }
      };
    }
  }

  /**
   * Destroy a subscription and clean up resources
   */
  async destroySubscription(subscriptionId: string): Promise<void> {
    const subscription = this.enhancedSubscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    try {
      // Unsubscribe from base telemetry manager
      await this.baseTelemetryManager.unsubscribe(subscription.streamId);
      
      // Clean up filters
      this.filterManager.removeFilterChain(subscription.channelMetadata.id);
      subscription.filters.forEach(filter => {
        this.filterManager.removeFilter(filter.id);
      });
      
      // Update routing table
      const channelSubscribers = this.dataRoutingTable.get(subscription.channelMetadata.id);
      if (channelSubscribers) {
        channelSubscribers.delete(subscriptionId);
        if (channelSubscribers.size === 0) {
          this.dataRoutingTable.delete(subscription.channelMetadata.id);
        }
      }
      
      // Handle dependencies - remove this subscription from dependents
      subscription.dependencies.forEach(depId => {
        const depSubscription = this.enhancedSubscriptions.get(depId);
        if (depSubscription) {
          depSubscription.dependents = depSubscription.dependents.filter(id => id !== subscriptionId);
        }
      });
      
      // Handle dependents - this subscription can no longer be a dependency
      subscription.dependents.forEach(depId => {
        const depSubscription = this.enhancedSubscriptions.get(depId);
        if (depSubscription) {
          depSubscription.dependencies = depSubscription.dependencies.filter(id => id !== subscriptionId);
          // Might need to pause or reconfigure dependent subscriptions
        }
      });
      
      // Remove from groups
      for (const group of this.subscriptionGroups.values()) {
        if (group.subscriptionIds.includes(subscriptionId)) {
          group.subscriptionIds = group.subscriptionIds.filter(id => id !== subscriptionId);
          group.updatedAt = Date.now();
        }
      }
      
      // Remove the subscription
      this.enhancedSubscriptions.delete(subscriptionId);
      
      this.emit('subscription:destroyed', subscriptionId);
      
    } catch (error) {
      console.error(`Failed to destroy subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Create a subscription group for batch management
   */
  createSubscriptionGroup(
    name: string,
    subscriptionIds: string[],
    description?: string
  ): SubscriptionGroup {
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate that all subscription IDs exist
    const invalidIds = subscriptionIds.filter(id => !this.enhancedSubscriptions.has(id));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid subscription IDs: ${invalidIds.join(', ')}`);
    }
    
    const group: SubscriptionGroup = {
      id: groupId,
      name,
      description,
      subscriptionIds: [...subscriptionIds],
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Update subscriptions with group ID
    subscriptionIds.forEach(id => {
      const subscription = this.enhancedSubscriptions.get(id);
      if (subscription) {
        subscription.groupId = groupId;
      }
    });
    
    this.subscriptionGroups.set(groupId, group);
    this.emit('group:created', group);
    
    return group;
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): EnhancedSubscription | undefined {
    return this.enhancedSubscriptions.get(subscriptionId);
  }

  /**
   * Get all active subscriptions
   */
  getAllSubscriptions(): EnhancedSubscription[] {
    return Array.from(this.enhancedSubscriptions.values());
  }

  /**
   * Get subscriptions by channel ID
   */
  getSubscriptionsByChannel(channelId: string): EnhancedSubscription[] {
    return Array.from(this.enhancedSubscriptions.values())
      .filter(sub => sub.channelMetadata.id === channelId);
  }

  /**
   * Get subscriptions by group ID
   */
  getSubscriptionsByGroup(groupId: string): EnhancedSubscription[] {
    return Array.from(this.enhancedSubscriptions.values())
      .filter(sub => sub.groupId === groupId);
  }

  /**
   * Get performance metrics for all subscriptions
   */
  getPerformanceMetrics(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    averageLatency: number;
    totalThroughput: number;
    resourceUsage: {
      totalMemoryMB: number;
      totalCpuPercent: number;
      totalNetworkMbps: number;
    };
    channelMetrics: Map<string, any>;
  } {
    const subscriptions = Array.from(this.enhancedSubscriptions.values());
    const activeSubscriptions = subscriptions.filter(sub => sub.active);
    
    const totalLatency = activeSubscriptions.reduce((sum, sub) => sum + sub.metrics.averageLatency, 0);
    const totalThroughput = activeSubscriptions.reduce((sum, sub) => sum + sub.metrics.throughputHz, 0);
    
    const resourceUsage = activeSubscriptions.reduce(
      (totals, sub) => ({
        totalMemoryMB: totals.totalMemoryMB + sub.metrics.resourceUsage.memoryMB,
        totalCpuPercent: totals.totalCpuPercent + sub.metrics.resourceUsage.cpuPercent,
        totalNetworkMbps: totals.totalNetworkMbps + sub.metrics.resourceUsage.networkMbps
      }),
      { totalMemoryMB: 0, totalCpuPercent: 0, totalNetworkMbps: 0 }
    );

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      averageLatency: activeSubscriptions.length > 0 ? totalLatency / activeSubscriptions.length : 0,
      totalThroughput,
      resourceUsage,
      channelMetrics: this.routingMetrics
    };
  }

  /**
   * Cleanup and destroy the manager
   */
  async destroy(): Promise<void> {
    // Stop performance monitoring
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
    }

    // Destroy all subscriptions
    const subscriptionIds = Array.from(this.enhancedSubscriptions.keys());
    await Promise.all(subscriptionIds.map(id => this.destroySubscription(id)));
    
    // Destroy base telemetry manager
    await this.baseTelemetryManager.destroy();
    
    // Clear all data structures
    this.enhancedSubscriptions.clear();
    this.subscriptionGroups.clear();
    this.channelDependencies.clear();
    this.dataRoutingTable.clear();
    this.routingMetrics.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  private setupEventHandlers(): void {
    // Handle telemetry data from base manager
    this.baseTelemetryManager.on('stream:data', (event) => {
      this.routeTelemetryData(event);
    });

    // Handle subscription lifecycle events
    this.baseTelemetryManager.on('stream:error', (streamId, error) => {
      const subscription = this.findSubscriptionByStreamId(streamId);
      if (subscription) {
        subscription.metrics.errorCount++;
        subscription.metrics.lastError = error;
        this.emit('error:subscription', subscription.subscriptionId, error);
      }
    });
  }

  private routeTelemetryData(event: any): void {
    const startTime = performance.now();
    const { streamId, data } = event;
    
    // Find subscription by stream ID
    const subscription = this.findSubscriptionByStreamId(streamId);
    if (!subscription) {
      return;
    }

    const channelId = subscription.channelMetadata.id;
    const subscribers = this.dataRoutingTable.get(channelId);
    
    if (subscribers) {
      let routedCount = 0;
      
      for (const subscriberId of subscribers) {
        const targetSubscription = this.enhancedSubscriptions.get(subscriberId);
        if (!targetSubscription || !targetSubscription.active) {
          continue;
        }

        // Apply filters
        const passesFilters = this.filterManager.applyFilters(
          channelId,
          data,
          {
            channelId,
            dataType: targetSubscription.channelMetadata.dataType,
            subscriptionConfig: targetSubscription.config
          }
        );

        if (passesFilters) {
          // Update subscription metrics
          targetSubscription.metrics.dataPointsReceived++;
          targetSubscription.lastActivity = Date.now();
          
          routedCount++;
        } else {
          targetSubscription.metrics.dataPointsFiltered++;
        }
      }

      // Update routing metrics
      const routingLatency = performance.now() - startTime;
      const existing = this.routingMetrics.get(channelId);
      this.routingMetrics.set(channelId, {
        subscriberCount: routedCount,
        averageLatency: existing ? 
          (existing.averageLatency * 0.9 + routingLatency * 0.1) : 
          routingLatency,
        throughput: existing ? existing.throughput + 1 : 1,
        lastUpdate: Date.now()
      });

      this.emit('data:routed', channelId, routedCount, routingLatency);
    }
  }

  private async createFiltersFromSpecs(filterSpecs: any[]): Promise<TelemetryFilter[]> {
    // This would be implemented to create actual filter instances
    // For now, return empty array
    return [];
  }

  private createStreamConfig(request: SubscriptionRequest, channelMetadata: ChannelMetadata): TelemetryStreamConfig {
    return {
      streamId: request.channelId,
      name: channelMetadata.name,
      dataType: channelMetadata.dataType,
      bufferSize: request.qos.bufferSize || 1000,
      sampleRate: request.frequency?.targetHz || channelMetadata.updateFrequency.typical,
      units: channelMetadata.format.qualitySpec?.units,
      minValue: channelMetadata.format.qualitySpec?.validRange.min,
      maxValue: channelMetadata.format.qualitySpec?.validRange.max,
      dimensions: channelMetadata.format.dimensions,
      metadata: {
        subscriptionId: request.subscriptionId,
        protocol: request.dataFormat.protocol,
        qos: request.qos
      }
    };
  }

  private subscriptionToRequest(
    subscription: EnhancedSubscription, 
    modifications?: Partial<SubscriptionRequest>
  ): SubscriptionRequest {
    // Convert enhanced subscription back to request format for validation
    const baseRequest: SubscriptionRequest = {
      channelId: subscription.channelMetadata.id,
      subscriptionId: subscription.subscriptionId,
      dataFormat: {
        protocol: Protocol.JSON, // Would extract from subscription config
        compression: false,
        includeMetadata: true,
        timestampFormat: 'unix'
      },
      frequency: {
        targetHz: subscription.config.sampleRate || 1,
        adaptive: false
      },
      qos: subscription.qos,
      lifetime: {
        ttl: subscription.lifecycle.expiresAt ? 
          Math.floor((subscription.lifecycle.expiresAt - Date.now()) / 1000) : 
          undefined,
        autoRenew: subscription.lifecycle.autoRenew
      }
    };

    return { ...baseRequest, ...modifications };
  }

  private async resolveDependencies(subscription: EnhancedSubscription): Promise<void> {
    // Dependency resolution logic would be implemented here
    // For now, just emit resolved event
    subscription.dependencies.forEach(depId => {
      this.emit('dependency:resolved', subscription.subscriptionId, depId);
    });
  }

  private updateDataRoutingTable(channelId: string, subscriptionId: string): void {
    if (!this.dataRoutingTable.has(channelId)) {
      this.dataRoutingTable.set(channelId, new Set());
    }
    this.dataRoutingTable.get(channelId)!.add(subscriptionId);
  }

  private findSubscriptionByStreamId(streamId: string): EnhancedSubscription | undefined {
    return Array.from(this.enhancedSubscriptions.values())
      .find(sub => sub.streamId === streamId);
  }

  private getExistingSubscriptionsAsMap(): Map<string, SubscriptionRequest> {
    const map = new Map<string, SubscriptionRequest>();
    for (const subscription of this.enhancedSubscriptions.values()) {
      map.set(subscription.subscriptionId, this.subscriptionToRequest(subscription));
    }
    return map;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitoringInterval = setInterval(() => {
      // Update subscription performance metrics
      for (const subscription of this.enhancedSubscriptions.values()) {
        // Calculate uptime
        subscription.metrics.uptime = Date.now() - subscription.createdAt;
        
        // Check for performance degradation
        if (subscription.metrics.averageLatency > subscription.qos.latencyTarget * 2) {
          this.emit('performance:degraded', subscription.subscriptionId, subscription.metrics);
        }
      }
      
      // Clean up old routing metrics
      const cutoff = Date.now() - 300000; // 5 minutes
      for (const [channelId, metrics] of this.routingMetrics) {
        if (metrics.lastUpdate < cutoff) {
          this.routingMetrics.delete(channelId);
        }
      }
    }, 10000); // Run every 10 seconds
  }
}