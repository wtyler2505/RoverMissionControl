/**
 * ChannelRegistry - Telemetry Channel Management and Metadata Registry
 * 
 * Maintains comprehensive metadata about all available telemetry channels including:
 * - Channel identifiers and descriptions
 * - Data types and formats for each channel
 * - Update frequency capabilities
 * - Permission requirements and RBAC integration
 * - Channel discovery and registration
 */

import { EventEmitter } from './EventEmitter';
import { TelemetryDataType } from './TelemetryManager';
import { Priority, Protocol } from './types';

/**
 * Permission levels for channel access
 */
export enum ChannelPermissionLevel {
  PUBLIC = 'public',           // Available to all authenticated users
  RESTRICTED = 'restricted',   // Requires specific role/permission
  PRIVATE = 'private',         // Owner/admin only
  SYSTEM = 'system'           // System-level access required
}

/**
 * Channel category for organization
 */
export enum ChannelCategory {
  SENSOR = 'sensor',           // Physical sensor data
  ACTUATOR = 'actuator',       // Actuator status and commands
  NAVIGATION = 'navigation',   // GPS, IMU, positioning data
  POWER = 'power',            // Battery, power consumption
  THERMAL = 'thermal',        // Temperature sensors
  COMMUNICATION = 'communication', // Radio, network status
  DIAGNOSTICS = 'diagnostics', // System health, errors
  COMMANDS = 'commands',       // Command execution status
  CUSTOM = 'custom'           // User-defined channels
}

/**
 * Data quality indicators for channels
 */
export interface DataQualitySpec {
  accuracyBits: number;        // Number of significant bits
  precision: number;           // Decimal precision
  noiseFloor: number;         // Minimum meaningful change
  calibrationDate?: Date;     // Last calibration
  validRange: {
    min: number;
    max: number;
  };
  units: string;
  unitSystem: 'metric' | 'imperial' | 'raw';
}

/**
 * Comprehensive channel metadata definition
 */
export interface ChannelMetadata {
  id: string;                  // Unique channel identifier
  name: string;               // Human-readable name
  description: string;        // Detailed description
  category: ChannelCategory;  // Channel category
  dataType: TelemetryDataType; // Expected data type
  
  // Frequency and performance characteristics
  updateFrequency: {
    min: number;              // Minimum update rate (Hz)
    max: number;              // Maximum update rate (Hz)
    typical: number;          // Typical update rate (Hz)
    adaptive: boolean;        // Can adapt frequency based on load
  };
  
  // Data format and validation
  format: {
    schema?: any;             // JSON schema for validation
    dimensions?: {            // For vector/matrix data
      rows?: number;
      cols?: number;
      depth?: number;
    };
    encoding?: string;        // Data encoding (utf-8, base64, etc.)
    compression?: string;     // Compression algorithm
    qualitySpec?: DataQualitySpec;
  };
  
  // Access control and permissions
  permissions: {
    level: ChannelPermissionLevel;
    requiredRoles: string[];
    requiredPermissions: string[];
    rateLimits?: {
      maxSubscriptions: number;
      maxRequestsPerMinute: number;
      maxBandwidthMbps: number;
    };
  };
  
  // Network and transport optimization
  transport: {
    preferredProtocol: Protocol;
    supportedProtocols: Protocol[];
    compressionRecommended: boolean;
    priority: Priority;
    reliability: 'at-most-once' | 'at-least-once' | 'exactly-once';
  };
  
  // Channel lifecycle and status
  status: {
    active: boolean;
    healthy: boolean;
    lastSeen?: Date;
    errorCount: number;
    warningCount: number;
    maintenanceMode: boolean;
  };
  
  // Additional metadata
  tags: string[];             // Searchable tags
  source: string;             // Data source identifier
  dependencies: string[];     // Other channels this depends on
  children: string[];         // Sub-channels
  parent?: string;           // Parent channel
  version: string;           // Channel definition version
  createdAt: Date;
  updatedAt: Date;
  deprecated?: {
    since: Date;
    replacedBy?: string;
    reason: string;
  };
}

/**
 * Channel discovery result
 */
export interface ChannelDiscoveryResult {
  channels: ChannelMetadata[];
  totalCount: number;
  categories: Map<ChannelCategory, number>;
  permissions: Map<ChannelPermissionLevel, number>;
  lastDiscovery: Date;
  discoveryDuration: number;
}

/**
 * Channel registry events
 */
export interface ChannelRegistryEvents {
  'channel:registered': (channel: ChannelMetadata) => void;
  'channel:updated': (channel: ChannelMetadata, previous: ChannelMetadata) => void;
  'channel:removed': (channelId: string) => void;
  'channel:status-changed': (channelId: string, status: any) => void;
  'registry:discovery-complete': (result: ChannelDiscoveryResult) => void;
  'registry:error': (error: Error) => void;
}

/**
 * Channel query filters for searching and filtering channels
 */
export interface ChannelQueryFilter {
  categories?: ChannelCategory[];
  dataTypes?: TelemetryDataType[];
  permissionLevels?: ChannelPermissionLevel[];
  tags?: string[];
  search?: string;            // Text search in name/description
  frequencyRange?: {
    min?: number;
    max?: number;
  };
  healthyOnly?: boolean;
  activeOnly?: boolean;
  requiredPermissions?: string[];
  excludeDeprecated?: boolean;
}

/**
 * Channel registration and validation service
 */
export class ChannelRegistry extends EventEmitter<ChannelRegistryEvents> {
  private channels = new Map<string, ChannelMetadata>();
  private categoryIndex = new Map<ChannelCategory, Set<string>>();
  private tagIndex = new Map<string, Set<string>>();
  private permissionIndex = new Map<ChannelPermissionLevel, Set<string>>();
  private discoveryInProgress = false;
  private lastFullDiscovery?: Date;
  
  // Built-in channel definitions for common rover telemetry
  private readonly BUILTIN_CHANNELS: Partial<ChannelMetadata>[] = [
    {
      id: 'rover.position.gps',
      name: 'GPS Position',
      description: 'Global positioning system coordinates',
      category: ChannelCategory.NAVIGATION,
      dataType: TelemetryDataType.OBJECT,
      updateFrequency: { min: 0.1, max: 10, typical: 1, adaptive: true },
      format: {
        schema: {
          type: 'object',
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            altitude: { type: 'number' },
            accuracy: { type: 'number', minimum: 0 }
          },
          required: ['latitude', 'longitude']
        }
      },
      permissions: {
        level: ChannelPermissionLevel.PUBLIC,
        requiredRoles: ['operator', 'viewer'],
        requiredPermissions: ['telemetry.read']
      },
      transport: {
        preferredProtocol: Protocol.JSON,
        supportedProtocols: [Protocol.JSON, Protocol.MESSAGEPACK],
        compressionRecommended: false,
        priority: Priority.HIGH,
        reliability: 'at-least-once'
      },
      tags: ['navigation', 'position', 'gps']
    },
    {
      id: 'rover.sensors.imu',
      name: 'Inertial Measurement Unit',
      description: 'IMU accelerometer and gyroscope data',
      category: ChannelCategory.SENSOR,
      dataType: TelemetryDataType.OBJECT,
      updateFrequency: { min: 1, max: 200, typical: 50, adaptive: true },
      format: {
        schema: {
          type: 'object',
          properties: {
            acceleration: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' }
              }
            },
            gyroscope: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' }
              }
            }
          }
        },
        qualitySpec: {
          accuracyBits: 16,
          precision: 0.001,
          noiseFloor: 0.01,
          validRange: { min: -200, max: 200 },
          units: 'm/s²',
          unitSystem: 'metric'
        }
      },
      permissions: {
        level: ChannelPermissionLevel.PUBLIC,
        requiredRoles: ['operator', 'viewer'],
        requiredPermissions: ['telemetry.read']
      },
      transport: {
        preferredProtocol: Protocol.MESSAGEPACK,
        supportedProtocols: [Protocol.MESSAGEPACK, Protocol.CBOR, Protocol.JSON],
        compressionRecommended: true,
        priority: Priority.NORMAL,
        reliability: 'at-most-once'
      },
      tags: ['sensors', 'imu', 'acceleration', 'gyroscope']
    },
    {
      id: 'rover.power.battery',
      name: 'Battery Status',
      description: 'Battery voltage, current, and capacity',
      category: ChannelCategory.POWER,
      dataType: TelemetryDataType.OBJECT,
      updateFrequency: { min: 0.1, max: 5, typical: 1, adaptive: false },
      format: {
        schema: {
          type: 'object',
          properties: {
            voltage: { type: 'number', minimum: 0, maximum: 30 },
            current: { type: 'number', minimum: -50, maximum: 50 },
            capacity: { type: 'number', minimum: 0, maximum: 100 },
            temperature: { type: 'number', minimum: -40, maximum: 85 }
          },
          required: ['voltage', 'current', 'capacity']
        },
        qualitySpec: {
          accuracyBits: 12,
          precision: 0.01,
          noiseFloor: 0.001,
          validRange: { min: 0, max: 30 },
          units: 'V',
          unitSystem: 'metric'
        }
      },
      permissions: {
        level: ChannelPermissionLevel.PUBLIC,
        requiredRoles: ['operator', 'viewer'],
        requiredPermissions: ['telemetry.read']
      },
      transport: {
        preferredProtocol: Protocol.JSON,
        supportedProtocols: [Protocol.JSON, Protocol.MESSAGEPACK],
        compressionRecommended: false,
        priority: Priority.HIGH,
        reliability: 'at-least-once'
      },
      tags: ['power', 'battery', 'voltage', 'current']
    },
    {
      id: 'rover.thermal.sensors',
      name: 'Temperature Sensors',
      description: 'Multiple temperature sensor readings',
      category: ChannelCategory.THERMAL,
      dataType: TelemetryDataType.VECTOR,
      updateFrequency: { min: 0.1, max: 2, typical: 0.5, adaptive: false },
      format: {
        dimensions: { cols: 8 }, // 8 temperature sensors
        qualitySpec: {
          accuracyBits: 16,
          precision: 0.1,
          noiseFloor: 0.01,
          validRange: { min: -40, max: 125 },
          units: '°C',
          unitSystem: 'metric'
        }
      },
      permissions: {
        level: ChannelPermissionLevel.PUBLIC,
        requiredRoles: ['operator', 'viewer'],
        requiredPermissions: ['telemetry.read']
      },
      transport: {
        preferredProtocol: Protocol.MESSAGEPACK,
        supportedProtocols: [Protocol.MESSAGEPACK, Protocol.CBOR],
        compressionRecommended: false,
        priority: Priority.NORMAL,
        reliability: 'at-most-once'
      },
      tags: ['thermal', 'temperature', 'sensors']
    },
    {
      id: 'rover.diagnostics.system',
      name: 'System Diagnostics',
      description: 'System health, errors, and diagnostic information',
      category: ChannelCategory.DIAGNOSTICS,
      dataType: TelemetryDataType.OBJECT,
      updateFrequency: { min: 0.1, max: 1, typical: 0.2, adaptive: true },
      permissions: {
        level: ChannelPermissionLevel.RESTRICTED,
        requiredRoles: ['admin', 'technician'],
        requiredPermissions: ['diagnostics.read', 'system.monitor']
      },
      transport: {
        preferredProtocol: Protocol.JSON,
        supportedProtocols: [Protocol.JSON],
        compressionRecommended: true,
        priority: Priority.LOW,
        reliability: 'at-least-once'
      },
      tags: ['diagnostics', 'system', 'health', 'errors']
    }
  ];

  constructor() {
    super();
    this.initializeBuiltinChannels();
  }

  /**
   * Register a new telemetry channel
   */
  async registerChannel(channelData: Partial<ChannelMetadata>): Promise<ChannelMetadata> {
    if (!channelData.id) {
      throw new Error('Channel ID is required');
    }

    if (this.channels.has(channelData.id)) {
      throw new Error(`Channel already exists: ${channelData.id}`);
    }

    // Fill in defaults and validate
    const channel = this.fillChannelDefaults(channelData);
    this.validateChannel(channel);

    // Store channel
    this.channels.set(channel.id, channel);
    this.updateIndices(channel);

    this.emit('channel:registered', channel);
    return channel;
  }

  /**
   * Update an existing channel's metadata
   */
  async updateChannel(channelId: string, updates: Partial<ChannelMetadata>): Promise<ChannelMetadata> {
    const existing = this.channels.get(channelId);
    if (!existing) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const previous = { ...existing };
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    
    this.validateChannel(updated);
    
    // Update storage and indices
    this.channels.set(channelId, updated);
    this.removeFromIndices(channelId);
    this.updateIndices(updated);

    this.emit('channel:updated', updated, previous);
    return updated;
  }

  /**
   * Remove a channel from the registry
   */
  async removeChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    this.channels.delete(channelId);
    this.removeFromIndices(channelId);
    
    this.emit('channel:removed', channelId);
  }

  /**
   * Get channel metadata by ID
   */
  getChannel(channelId: string): ChannelMetadata | null {
    return this.channels.get(channelId) || null;
  }

  /**
   * Query channels with filtering and search
   */
  queryChannels(filter?: ChannelQueryFilter): ChannelMetadata[] {
    let results = Array.from(this.channels.values());

    if (filter) {
      // Apply category filter
      if (filter.categories && filter.categories.length > 0) {
        results = results.filter(ch => filter.categories!.includes(ch.category));
      }

      // Apply data type filter
      if (filter.dataTypes && filter.dataTypes.length > 0) {
        results = results.filter(ch => filter.dataTypes!.includes(ch.dataType));
      }

      // Apply permission level filter
      if (filter.permissionLevels && filter.permissionLevels.length > 0) {
        results = results.filter(ch => filter.permissionLevels!.includes(ch.permissions.level));
      }

      // Apply tag filter
      if (filter.tags && filter.tags.length > 0) {
        results = results.filter(ch => 
          filter.tags!.some(tag => ch.tags.includes(tag))
        );
      }

      // Apply text search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        results = results.filter(ch => 
          ch.name.toLowerCase().includes(searchLower) ||
          ch.description.toLowerCase().includes(searchLower) ||
          ch.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Apply frequency range filter
      if (filter.frequencyRange) {
        results = results.filter(ch => {
          const freq = ch.updateFrequency.typical;
          if (filter.frequencyRange!.min !== undefined && freq < filter.frequencyRange!.min) return false;
          if (filter.frequencyRange!.max !== undefined && freq > filter.frequencyRange!.max) return false;
          return true;
        });
      }

      // Apply health filter
      if (filter.healthyOnly) {
        results = results.filter(ch => ch.status.healthy);
      }

      // Apply active filter
      if (filter.activeOnly) {
        results = results.filter(ch => ch.status.active);
      }

      // Apply deprecated filter
      if (filter.excludeDeprecated) {
        results = results.filter(ch => !ch.deprecated);
      }
    }

    return results;
  }

  /**
   * Get all available channel categories
   */
  getCategories(): Map<ChannelCategory, number> {
    const categories = new Map<ChannelCategory, number>();
    for (const [category, channelIds] of this.categoryIndex) {
      categories.set(category, channelIds.size);
    }
    return categories;
  }

  /**
   * Get all available tags
   */
  getTags(): Map<string, number> {
    const tags = new Map<string, number>();
    for (const [tag, channelIds] of this.tagIndex) {
      tags.set(tag, channelIds.size);
    }
    return tags;
  }

  /**
   * Check if user has permission to access a channel
   */
  checkChannelPermission(
    channelId: string, 
    userRoles: string[], 
    userPermissions: string[]
  ): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    const { level, requiredRoles, requiredPermissions } = channel.permissions;

    // Public channels are accessible to all authenticated users
    if (level === ChannelPermissionLevel.PUBLIC) {
      return true;
    }

    // Check role requirements
    if (requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
      if (!hasRequiredRole) return false;
    }

    // Check permission requirements
    if (requiredPermissions.length > 0) {
      const hasRequiredPermission = requiredPermissions.some(perm => userPermissions.includes(perm));
      if (!hasRequiredPermission) return false;
    }

    return true;
  }

  /**
   * Discover available channels from the server
   */
  async discoverChannels(forceRefresh = false): Promise<ChannelDiscoveryResult> {
    if (this.discoveryInProgress) {
      throw new Error('Channel discovery already in progress');
    }

    if (!forceRefresh && this.lastFullDiscovery && 
        Date.now() - this.lastFullDiscovery.getTime() < 30000) {
      // Return cached results if discovery was recent
      return this.buildDiscoveryResult();
    }

    this.discoveryInProgress = true;
    const startTime = Date.now();

    try {
      // In a real implementation, this would query the server
      // For now, we'll simulate discovery with built-in channels
      const discoveredChannels = await this.simulateChannelDiscovery();
      
      // Update registry with discovered channels
      for (const channelData of discoveredChannels) {
        if (!this.channels.has(channelData.id)) {
          await this.registerChannel(channelData);
        }
      }

      this.lastFullDiscovery = new Date();
      const result = this.buildDiscoveryResult();
      result.discoveryDuration = Date.now() - startTime;

      this.emit('registry:discovery-complete', result);
      return result;

    } catch (error) {
      this.emit('registry:error', error as Error);
      throw error;
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Update channel status (health, activity, etc.)
   */
  updateChannelStatus(channelId: string, statusUpdate: Partial<ChannelMetadata['status']>): void {
    const channel = this.channels.get(channelId);
    if (!channel) {
      console.warn(`Cannot update status for unknown channel: ${channelId}`);
      return;
    }

    const previousStatus = { ...channel.status };
    Object.assign(channel.status, statusUpdate);
    channel.updatedAt = new Date();

    this.emit('channel:status-changed', channelId, { previous: previousStatus, current: channel.status });
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalChannels: number;
    activeChannels: number;
    healthyChannels: number;
    categoryCounts: Map<ChannelCategory, number>;
    permissionCounts: Map<ChannelPermissionLevel, number>;
    dataTypeCounts: Map<TelemetryDataType, number>;
  } {
    const channels = Array.from(this.channels.values());
    
    return {
      totalChannels: channels.length,
      activeChannels: channels.filter(ch => ch.status.active).length,
      healthyChannels: channels.filter(ch => ch.status.healthy).length,
      categoryCounts: this.getCategories(),
      permissionCounts: new Map(
        Object.values(ChannelPermissionLevel).map(level => [
          level,
          channels.filter(ch => ch.permissions.level === level).length
        ])
      ),
      dataTypeCounts: new Map(
        Object.values(TelemetryDataType).map(type => [
          type,
          channels.filter(ch => ch.dataType === type).length
        ])
      )
    };
  }

  /**
   * Export registry data for backup/analysis
   */
  exportRegistry(): {
    channels: ChannelMetadata[];
    metadata: {
      exportedAt: Date;
      totalChannels: number;
      lastDiscovery?: Date;
    };
  } {
    return {
      channels: Array.from(this.channels.values()),
      metadata: {
        exportedAt: new Date(),
        totalChannels: this.channels.size,
        lastDiscovery: this.lastFullDiscovery
      }
    };
  }

  /**
   * Import registry data from backup
   */
  async importRegistry(data: { channels: ChannelMetadata[] }): Promise<void> {
    for (const channelData of data.channels) {
      try {
        if (this.channels.has(channelData.id)) {
          await this.updateChannel(channelData.id, channelData);
        } else {
          await this.registerChannel(channelData);
        }
      } catch (error) {
        console.warn(`Failed to import channel ${channelData.id}:`, error);
      }
    }
  }

  private initializeBuiltinChannels(): void {
    // Initialize built-in channels asynchronously
    setTimeout(async () => {
      for (const channelData of this.BUILTIN_CHANNELS) {
        try {
          await this.registerChannel(channelData);
        } catch (error) {
          console.warn(`Failed to register built-in channel:`, error);
        }
      }
    }, 0);
  }

  private fillChannelDefaults(channelData: Partial<ChannelMetadata>): ChannelMetadata {
    const now = new Date();
    
    return {
      id: channelData.id!,
      name: channelData.name || channelData.id!,
      description: channelData.description || '',
      category: channelData.category || ChannelCategory.CUSTOM,
      dataType: channelData.dataType || TelemetryDataType.OBJECT,
      
      updateFrequency: {
        min: 0.1,
        max: 100,
        typical: 1,
        adaptive: false,
        ...channelData.updateFrequency
      },
      
      format: {
        ...channelData.format
      },
      
      permissions: {
        level: ChannelPermissionLevel.PUBLIC,
        requiredRoles: [],
        requiredPermissions: [],
        ...channelData.permissions
      },
      
      transport: {
        preferredProtocol: Protocol.JSON,
        supportedProtocols: [Protocol.JSON],
        compressionRecommended: false,
        priority: Priority.NORMAL,
        reliability: 'at-most-once',
        ...channelData.transport
      },
      
      status: {
        active: true,
        healthy: true,
        errorCount: 0,
        warningCount: 0,
        maintenanceMode: false,
        ...channelData.status
      },
      
      tags: channelData.tags || [],
      source: channelData.source || 'unknown',
      dependencies: channelData.dependencies || [],
      children: channelData.children || [],
      parent: channelData.parent,
      version: channelData.version || '1.0.0',
      createdAt: channelData.createdAt || now,
      updatedAt: channelData.updatedAt || now,
      deprecated: channelData.deprecated
    };
  }

  private validateChannel(channel: ChannelMetadata): void {
    if (!channel.id || channel.id.trim().length === 0) {
      throw new Error('Channel ID cannot be empty');
    }

    if (!channel.name || channel.name.trim().length === 0) {
      throw new Error('Channel name cannot be empty');
    }

    if (channel.updateFrequency.min < 0 || channel.updateFrequency.max < 0) {
      throw new Error('Update frequency cannot be negative');
    }

    if (channel.updateFrequency.min > channel.updateFrequency.max) {
      throw new Error('Minimum update frequency cannot exceed maximum');
    }

    // Validate channel ID format (should be namespace.category.name)
    const idParts = channel.id.split('.');
    if (idParts.length < 2) {
      console.warn(`Channel ID ${channel.id} does not follow recommended format: namespace.category.name`);
    }
  }

  private updateIndices(channel: ChannelMetadata): void {
    // Update category index
    if (!this.categoryIndex.has(channel.category)) {
      this.categoryIndex.set(channel.category, new Set());
    }
    this.categoryIndex.get(channel.category)!.add(channel.id);

    // Update tag index
    for (const tag of channel.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(channel.id);
    }

    // Update permission index
    if (!this.permissionIndex.has(channel.permissions.level)) {
      this.permissionIndex.set(channel.permissions.level, new Set());
    }
    this.permissionIndex.get(channel.permissions.level)!.add(channel.id);
  }

  private removeFromIndices(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Remove from category index
    this.categoryIndex.get(channel.category)?.delete(channelId);

    // Remove from tag index
    for (const tag of channel.tags) {
      this.tagIndex.get(tag)?.delete(channelId);
    }

    // Remove from permission index
    this.permissionIndex.get(channel.permissions.level)?.delete(channelId);
  }

  private buildDiscoveryResult(): ChannelDiscoveryResult {
    return {
      channels: Array.from(this.channels.values()),
      totalCount: this.channels.size,
      categories: this.getCategories(),
      permissions: new Map(
        Object.values(ChannelPermissionLevel).map(level => [
          level,
          Array.from(this.channels.values()).filter(ch => ch.permissions.level === level).length
        ])
      ),
      lastDiscovery: this.lastFullDiscovery || new Date(),
      discoveryDuration: 0
    };
  }

  private async simulateChannelDiscovery(): Promise<Partial<ChannelMetadata>[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return additional discovered channels
    return [
      {
        id: 'rover.actuators.wheels',
        name: 'Wheel Motors',
        description: 'Individual wheel motor status and control',
        category: ChannelCategory.ACTUATOR,
        dataType: TelemetryDataType.VECTOR,
        updateFrequency: { min: 1, max: 20, typical: 10, adaptive: true },
        permissions: {
          level: ChannelPermissionLevel.RESTRICTED,
          requiredRoles: ['operator'],
          requiredPermissions: ['actuators.read']
        },
        tags: ['actuators', 'wheels', 'motors']
      },
      {
        id: 'rover.communication.radio',
        name: 'Radio Status',
        description: 'Radio communication link status and signal strength',
        category: ChannelCategory.COMMUNICATION,
        dataType: TelemetryDataType.OBJECT,
        updateFrequency: { min: 0.1, max: 1, typical: 0.5, adaptive: false },
        permissions: {
          level: ChannelPermissionLevel.PUBLIC,
          requiredRoles: ['operator', 'viewer'],
          requiredPermissions: ['telemetry.read']
        },
        tags: ['communication', 'radio', 'signal']
      }
    ];
  }
}