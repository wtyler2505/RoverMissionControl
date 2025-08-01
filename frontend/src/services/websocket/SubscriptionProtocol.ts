/**
 * SubscriptionProtocol - Standardized Subscription Message Format and Validation
 * 
 * Defines standardized message formats for telemetry subscriptions including:
 * - JSON schema for subscription requests and responses
 * - Channel identifiers and filter specifications
 * - Requested update frequency and lifetime parameters
 * - Subscription confirmations, rejections, and notifications
 * - Protocol versioning and compatibility
 */

import { TelemetryFilter, FilterConfiguration, ComparisonOperator, LogicalOperator } from './TelemetryFilters';
import { ChannelMetadata, ChannelPermissionLevel } from './ChannelRegistry';
import { Priority, Protocol } from './types';

/**
 * Protocol version for subscription messages
 */
export const SUBSCRIPTION_PROTOCOL_VERSION = '2.1.0';

/**
 * Message types for subscription protocol
 */
export enum SubscriptionMessageType {
  // Client to Server
  SUBSCRIBE_REQUEST = 'subscription.subscribe.request',
  UNSUBSCRIBE_REQUEST = 'subscription.unsubscribe.request',
  MODIFY_REQUEST = 'subscription.modify.request',
  BATCH_REQUEST = 'subscription.batch.request',
  STATUS_REQUEST = 'subscription.status.request',
  
  // Server to Client
  SUBSCRIBE_RESPONSE = 'subscription.subscribe.response',
  UNSUBSCRIBE_RESPONSE = 'subscription.unsubscribe.response',
  MODIFY_RESPONSE = 'subscription.modify.response',
  BATCH_RESPONSE = 'subscription.batch.response',
  STATUS_RESPONSE = 'subscription.status.response',
  
  // Notifications
  SUBSCRIPTION_DATA = 'subscription.data',
  SUBSCRIPTION_STATUS = 'subscription.status.changed',
  SUBSCRIPTION_ERROR = 'subscription.error',
  SUBSCRIPTION_WARNING = 'subscription.warning',
  CHANNEL_DISCOVERY = 'subscription.channels.discovered'
}

/**
 * Subscription request status codes
 */
export enum SubscriptionStatusCode {
  // Success codes (2xx)
  SUCCESS = 200,
  CREATED = 201,
  ACCEPTED = 202,
  PARTIAL_SUCCESS = 206,
  
  // Client error codes (4xx)
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  RATE_LIMITED = 429,
  
  // Server error codes (5xx)  
  INTERNAL_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503,
  TIMEOUT = 504
}

/**
 * Base subscription message envelope
 */
export interface SubscriptionMessage {
  version: string;
  type: SubscriptionMessageType;
  messageId: string;
  timestamp: number;
  clientId?: string;
  sessionId?: string;
  payload: any;
}

/**
 * Filter specification for subscription requests
 */
export interface SubscriptionFilterSpec {
  id: string;
  type: 'property' | 'temporal' | 'frequency' | 'quality' | 'compound';
  enabled: boolean;
  parameters: Record<string, any>;
  priority?: number;
}

/**
 * Comprehensive subscription request payload
 */
export interface SubscriptionRequest {
  // Channel identification
  channelId: string;
  channelVersion?: string;
  
  // Subscription configuration
  subscriptionId?: string;      // Client-provided ID, server will generate if not provided
  name?: string;               // Human-readable subscription name
  description?: string;        // Subscription description
  
  // Data delivery preferences
  dataFormat: {
    protocol: Protocol;
    compression?: boolean;
    batchSize?: number;         // Number of data points per batch
    batchTimeout?: number;      // Maximum time to wait for batch completion (ms)  
    includeMetadata?: boolean;
    timestampFormat?: 'unix' | 'iso8601' | 'relative';
  };
  
  // Update frequency control
  frequency: {
    targetHz?: number;          // Desired update frequency
    maxHz?: number;            // Maximum acceptable frequency
    minHz?: number;            // Minimum required frequency
    adaptive?: boolean;         // Allow server to adjust frequency
    priority?: Priority;        // Priority for frequency allocation
  };
  
  // Filtering and processing
  filters?: SubscriptionFilterSpec[];
  
  // Quality of service
  qos: {
    reliability: 'at-most-once' | 'at-least-once' | 'exactly-once';
    durability?: boolean;       // Persist subscription across disconnections
    ordered?: boolean;          // Maintain data ordering
    bufferSize?: number;        // Client-side buffer size
    latencyTarget?: number;     // Target end-to-end latency (ms)
  };
  
  // Subscription lifetime
  lifetime: {
    ttl?: number;              // Time to live in seconds
    expiresAt?: number;        // Absolute expiration timestamp
    autoRenew?: boolean;       // Automatically renew before expiration
    renewInterval?: number;    // Renewal interval in seconds
  };
  
  // Access control
  permissions?: {
    shareWithSessions?: string[];  // Share with specific session IDs
    allowModification?: boolean;   // Allow other sessions to modify
    requireAck?: boolean;         // Require acknowledgment for data
  };
  
  // Advanced options
  options?: {
    includeHistory?: {
      enabled: boolean;
      maxPoints?: number;
      timeRange?: number;        // Historical data time range (ms)
    };
    alerting?: {
      enabled: boolean;
      conditions?: Array<{
        filter: SubscriptionFilterSpec;
        action: 'notify' | 'escalate' | 'pause';
        message?: string;
      }>;
    };
    debugging?: {
      enableTracing?: boolean;
      logLevel?: 'error' | 'warn' | 'info' | 'debug';
      includeTimings?: boolean;
    };
  };
}

/**
 * Subscription response payload
 */
export interface SubscriptionResponse {
  // Request correlation
  requestId: string;
  subscriptionId: string;
  
  // Response status
  status: {
    code: SubscriptionStatusCode;
    message: string;
    details?: Record<string, any>;
  };
  
  // Granted configuration (may differ from requested)
  granted?: {
    channelId: string;
    channelMetadata: ChannelMetadata;
    dataFormat: SubscriptionRequest['dataFormat'];
    frequency: {
      actualHz: number;
      guaranteedHz: number;
      adaptive: boolean;
    };
    qos: SubscriptionRequest['qos'];
    lifetime: {
      expiresAt: number;
      renewalRequired: boolean;
    };
    appliedFilters: SubscriptionFilterSpec[];
  };
  
  // Server capabilities and limits
  serverInfo?: {
    maxConcurrentSubscriptions: number;
    supportedProtocols: Protocol[];
    maxFrequencyHz: number;
    maxBatchSize: number;
    features: string[];
  };
  
  // Warnings and recommendations
  warnings?: Array<{
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
}

/**
 * Batch subscription request for multiple channels
 */
export interface BatchSubscriptionRequest {
  requestId: string;
  subscriptions: SubscriptionRequest[];
  options?: {
    failOnAnyError?: boolean;    // Fail entire batch if any subscription fails
    transactional?: boolean;     // All-or-nothing subscription
    maxConcurrency?: number;     // Maximum concurrent subscription attempts
  };
}

/**
 * Batch subscription response
 */
export interface BatchSubscriptionResponse {
  requestId: string;
  status: {
    code: SubscriptionStatusCode;
    message: string;
    successCount: number;
    failureCount: number;
  };
  results: Array<{
    channelId: string;
    subscriptionId?: string;
    status: SubscriptionStatusCode;
    response?: SubscriptionResponse;
    error?: string;
  }>;
}

/**
 * Subscription data message payload
 */
export interface SubscriptionDataMessage {
  subscriptionId: string;
  channelId: string;
  sequenceNumber: number;
  batchId?: string;
  
  // Data payload
  data: Array<{
    timestamp: number;
    value: any;
    quality?: number;
    metadata?: Record<string, any>;
  }>;
  
  // Delivery metadata
  delivery: {
    protocol: Protocol;
    compressed: boolean;
    batchSize: number;
    isLastInBatch: boolean;
    serverTimestamp: number;
    processingTime?: number;     // Server-side processing time
  };
  
  // Quality metrics
  metrics?: {
    dataRate: number;           // Current data rate (Hz)
    latency: number;            // End-to-end latency (ms)
    lossRate: number;           // Data loss percentage
    filterPassRate: number;     // Filter pass rate
  };
}

/**
 * Subscription status change notification
 */
export interface SubscriptionStatusChange {
  subscriptionId: string;
  channelId: string;
  previousStatus: string;
  currentStatus: 'active' | 'paused' | 'error' | 'expired' | 'cancelled';
  reason: string;
  timestamp: number;
  
  // Additional context
  context?: {
    errorCode?: string;
    errorMessage?: string;
    suggestedAction?: string;
    retryAfter?: number;        // Suggested retry delay (seconds)
  };
}

/**
 * JSON Schema definitions for validation
 */
export const SUBSCRIPTION_SCHEMAS = {
  // Subscription request schema
  subscriptionRequest: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['channelId', 'dataFormat', 'qos'],
    properties: {
      channelId: {
        type: 'string',
        pattern: '^[a-zA-Z0-9._-]+$',
        minLength: 1,
        maxLength: 100
      },
      channelVersion: {
        type: 'string',
        pattern: '^\\d+\\.\\d+\\.\\d+$'
      },
      subscriptionId: {
        type: 'string',
        pattern: '^[a-zA-Z0-9._-]+$',
        maxLength: 50
      },
      name: {
        type: 'string',
        maxLength: 100
      },
      description: {
        type: 'string',
        maxLength: 500
      },
      dataFormat: {
        type: 'object',
        required: ['protocol'],
        properties: {
          protocol: {
            type: 'string',
            enum: ['json', 'messagepack', 'cbor', 'binary']
          },
          compression: { type: 'boolean' },
          batchSize: {
            type: 'integer',
            minimum: 1,
            maximum: 10000
          },
          batchTimeout: {
            type: 'integer',
            minimum: 10,
            maximum: 60000
          },
          includeMetadata: { type: 'boolean' },
          timestampFormat: {
            type: 'string',
            enum: ['unix', 'iso8601', 'relative']
          }
        }
      },
      frequency: {
        type: 'object',
        properties: {
          targetHz: {
            type: 'number',
            minimum: 0.001,
            maximum: 10000
          },
          maxHz: {
            type: 'number',
            minimum: 0.001,
            maximum: 10000
          },
          minHz: {
            type: 'number',
            minimum: 0.001,
            maximum: 10000
          },
          adaptive: { type: 'boolean' },
          priority: {
            type: 'integer',
            minimum: 0,
            maximum: 3
          }
        }
      },
      filters: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'type', 'enabled', 'parameters'],
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['property', 'temporal', 'frequency', 'quality', 'compound']
            },
            enabled: { type: 'boolean' },
            parameters: { type: 'object' },
            priority: {
              type: 'integer',
              minimum: 0,
              maximum: 100
            }
          }
        }
      },
      qos: {
        type: 'object',
        required: ['reliability'],
        properties: {
          reliability: {
            type: 'string',
            enum: ['at-most-once', 'at-least-once', 'exactly-once']
          },
          durability: { type: 'boolean' },
          ordered: { type: 'boolean' },
          bufferSize: {
            type: 'integer',
            minimum: 1,
            maximum: 1000000
          },
          latencyTarget: {
            type: 'integer',
            minimum: 1,
            maximum: 30000
          }
        }
      },
      lifetime: {
        type: 'object',
        properties: {
          ttl: {
            type: 'integer',
            minimum: 1,
            maximum: 86400 * 7  // Max 1 week
          },
          expiresAt: {
            type: 'integer',
            minimum: 0
          },
          autoRenew: { type: 'boolean' },
          renewInterval: {
            type: 'integer',
            minimum: 60,
            maximum: 86400
          }
        }
      }
    }
  },

  // Subscription data message schema
  subscriptionDataMessage: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['subscriptionId', 'channelId', 'sequenceNumber', 'data', 'delivery'],
    properties: {
      subscriptionId: { type: 'string' },
      channelId: { type: 'string' },
      sequenceNumber: {
        type: 'integer',
        minimum: 0
      },
      batchId: { type: 'string' },
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['timestamp', 'value'],
          properties: {
            timestamp: {
              type: 'integer',
              minimum: 0
            },
            value: {},  // Any type allowed
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 1
            },
            metadata: { type: 'object' }
          }
        }
      },
      delivery: {
        type: 'object',
        required: ['protocol', 'compressed', 'batchSize', 'isLastInBatch', 'serverTimestamp'],
        properties: {
          protocol: {
            type: 'string',
            enum: ['json', 'messagepack', 'cbor', 'binary']
          },
          compressed: { type: 'boolean' },
          batchSize: {
            type: 'integer',
            minimum: 1
          },
          isLastInBatch: { type: 'boolean' },
          serverTimestamp: {
            type: 'integer',
            minimum: 0
          },
          processingTime: {
            type: 'number',
            minimum: 0
          }
        }
      }
    }
  }
};

/**
 * Subscription message validator using JSON schemas
 */
export class SubscriptionValidator {
  private static validateSchema(data: any, schema: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Basic type validation - in a real implementation, use a proper JSON schema validator like Ajv
      if (!this.validateObject(data, schema, '', errors)) {
        return { valid: false, errors };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [`Validation error: ${error}`] };
    }
  }

  private static validateObject(data: any, schema: any, path: string, errors: string[]): boolean {
    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null) {
        errors.push(`${path}: Expected object, got ${typeof data}`);
        return false;
      }

      // Check required properties
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in data)) {
            errors.push(`${path}: Missing required property '${required}'`);
            return false;
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, value] of Object.entries(data)) {
          const propSchema = schema.properties[key];
          if (propSchema) {
            const propPath = path ? `${path}.${key}` : key;
            if (!this.validateObject(value, propSchema, propPath, errors)) {
              return false;
            }
          }
        }
      }

      return true;
    }

    // Add more type validations as needed
    return true;
  }

  /**
   * Validate subscription request
   */
  static validateSubscriptionRequest(request: SubscriptionRequest): { valid: boolean; errors: string[] } {
    return this.validateSchema(request, SUBSCRIPTION_SCHEMAS.subscriptionRequest);
  }

  /**
   * Validate subscription data message
   */
  static validateSubscriptionDataMessage(message: SubscriptionDataMessage): { valid: boolean; errors: string[] } {
    return this.validateSchema(message, SUBSCRIPTION_SCHEMAS.subscriptionDataMessage);
  }

  /**
   * Validate subscription message envelope
   */
  static validateMessageEnvelope(message: SubscriptionMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message.version || typeof message.version !== 'string') {
      errors.push('Invalid or missing version');
    }

    if (!message.type || !Object.values(SubscriptionMessageType).includes(message.type)) {
      errors.push('Invalid or missing message type');
    }

    if (!message.messageId || typeof message.messageId !== 'string') {
      errors.push('Invalid or missing message ID');
    }

    if (!message.timestamp || typeof message.timestamp !== 'number' || message.timestamp <= 0) {
      errors.push('Invalid or missing timestamp');
    }

    if (!message.payload) {
      errors.push('Missing payload');
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Subscription message builder for creating properly formatted messages
 */
export class SubscriptionMessageBuilder {
  /**
   * Create a subscription request message
   */
  static createSubscriptionRequest(
    request: SubscriptionRequest,
    options?: {
      clientId?: string;
      sessionId?: string;
      messageId?: string;
    }
  ): SubscriptionMessage {
    return {
      version: SUBSCRIPTION_PROTOCOL_VERSION,
      type: SubscriptionMessageType.SUBSCRIBE_REQUEST,
      messageId: options?.messageId || this.generateMessageId(),
      timestamp: Date.now(),
      clientId: options?.clientId,
      sessionId: options?.sessionId,
      payload: request
    };
  }

  /**
   * Create a subscription response message
   */
  static createSubscriptionResponse(
    response: SubscriptionResponse,
    options?: {
      clientId?: string;
      sessionId?: string;
      messageId?: string;
    }
  ): SubscriptionMessage {
    return {
      version: SUBSCRIPTION_PROTOCOL_VERSION,
      type: SubscriptionMessageType.SUBSCRIBE_RESPONSE,
      messageId: options?.messageId || this.generateMessageId(),
      timestamp: Date.now(),
      clientId: options?.clientId,
      sessionId: options?.sessionId,
      payload: response
    };
  }

  /**
   * Create a subscription data message
   */
  static createSubscriptionDataMessage(
    data: SubscriptionDataMessage,
    options?: {
      clientId?: string;
      sessionId?: string;
      messageId?: string;
    }
  ): SubscriptionMessage {
    return {
      version: SUBSCRIPTION_PROTOCOL_VERSION,
      type: SubscriptionMessageType.SUBSCRIPTION_DATA,
      messageId: options?.messageId || this.generateMessageId(),
      timestamp: Date.now(),
      clientId: options?.clientId,
      sessionId: options?.sessionId,
      payload: data
    };
  }

  /**
   * Create a batch subscription request
   */
  static createBatchSubscriptionRequest(
    requests: SubscriptionRequest[],
    options?: {
      clientId?: string;
      sessionId?: string;
      messageId?: string;
      requestId?: string;
      failOnAnyError?: boolean;
      transactional?: boolean;
    }
  ): SubscriptionMessage {
    const batchRequest: BatchSubscriptionRequest = {
      requestId: options?.requestId || this.generateMessageId(),
      subscriptions: requests,
      options: {
        failOnAnyError: options?.failOnAnyError,
        transactional: options?.transactional
      }
    };

    return {
      version: SUBSCRIPTION_PROTOCOL_VERSION,
      type: SubscriptionMessageType.BATCH_REQUEST,
      messageId: options?.messageId || this.generateMessageId(),
      timestamp: Date.now(),
      clientId: options?.clientId,
      sessionId: options?.sessionId,
      payload: batchRequest
    };
  }

  /**
   * Create a subscription status change notification
   */
  static createStatusChangeNotification(
    statusChange: SubscriptionStatusChange,
    options?: {
      clientId?: string;
      sessionId?: string;
      messageId?: string;
    }
  ): SubscriptionMessage {
    return {
      version: SUBSCRIPTION_PROTOCOL_VERSION,
      type: SubscriptionMessageType.SUBSCRIPTION_STATUS,
      messageId: options?.messageId || this.generateMessageId(),
      timestamp: Date.now(),
      clientId: options?.clientId,
      sessionId: options?.sessionId,
      payload: statusChange
    };
  }

  /**
   * Generate a unique message ID
   */
  private static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Subscription protocol utilities
 */
export class SubscriptionProtocolUtils {
  /**
   * Check if a message is a subscription-related message
   */
  static isSubscriptionMessage(type: string): boolean {
    return Object.values(SubscriptionMessageType).includes(type as SubscriptionMessageType);
  }

  /**
   * Extract subscription ID from various message types
   */
  static extractSubscriptionId(message: SubscriptionMessage): string | null {
    switch (message.type) {
      case SubscriptionMessageType.SUBSCRIBE_RESPONSE:
      case SubscriptionMessageType.UNSUBSCRIBE_REQUEST:
      case SubscriptionMessageType.MODIFY_REQUEST:
        return message.payload.subscriptionId || null;
        
      case SubscriptionMessageType.SUBSCRIPTION_DATA:
      case SubscriptionMessageType.SUBSCRIPTION_STATUS:
        return message.payload.subscriptionId || null;
        
      default:
        return null;
    }
  }

  /**
   * Check if message is a request type
   */
  static isRequestMessage(type: SubscriptionMessageType): boolean {
    return type.endsWith('.request');
  }

  /**
   * Check if message is a response type
   */
  static isResponseMessage(type: SubscriptionMessageType): boolean {
    return type.endsWith('.response');
  }

  /**
   * Get response type for a request type
   */
  static getResponseType(requestType: SubscriptionMessageType): SubscriptionMessageType | null {
    switch (requestType) {
      case SubscriptionMessageType.SUBSCRIBE_REQUEST:
        return SubscriptionMessageType.SUBSCRIBE_RESPONSE;
      case SubscriptionMessageType.UNSUBSCRIBE_REQUEST:
        return SubscriptionMessageType.UNSUBSCRIBE_RESPONSE;
      case SubscriptionMessageType.MODIFY_REQUEST:
        return SubscriptionMessageType.MODIFY_RESPONSE;
      case SubscriptionMessageType.BATCH_REQUEST:
        return SubscriptionMessageType.BATCH_RESPONSE;
      case SubscriptionMessageType.STATUS_REQUEST:
        return SubscriptionMessageType.STATUS_RESPONSE;
      default:
        return null;
    }
  }

  /**
   * Create error response
   */
  static createErrorResponse(
    requestId: string,
    code: SubscriptionStatusCode,
    message: string,
    details?: Record<string, any>
  ): SubscriptionResponse {
    return {
      requestId,
      subscriptionId: '',
      status: {
        code,
        message,
        details
      }
    };
  }

  /**
   * Check if status code indicates success
   */
  static isSuccessCode(code: SubscriptionStatusCode): boolean {
    return code >= 200 && code < 300;
  }

  /**
   * Check if status code indicates client error
   */
  static isClientError(code: SubscriptionStatusCode): boolean {
    return code >= 400 && code < 500;
  }

  /**
   * Check if status code indicates server error
   */
  static isServerError(code: SubscriptionStatusCode): boolean {
    return code >= 500 && code < 600;
  }
}