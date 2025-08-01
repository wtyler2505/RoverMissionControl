/**
 * Command Serialization Service
 * Integrates with WebSocket binary protocols for efficient command transmission
 */

import React from 'react';
import { 
  SerializerFactory, 
  SerializerInterface,
  SizeEstimator,
  Protocol
} from '../websocket/BinarySerializer';
import { MessageType, Priority } from '../websocket/types';
import { Command, CommandType, CommandPriority } from './types';
import { CommandValidator, CommandSchema } from './CommandValidator';
import { z } from 'zod';

/**
 * Serialization options
 */
export interface SerializationOptions {
  protocol?: Protocol;
  compress?: boolean;
  validate?: boolean;
  includeMetadata?: boolean;
}

/**
 * Serialization result
 */
export interface SerializationResult {
  data: Uint8Array | ArrayBuffer;
  protocol: Protocol;
  size: number;
  compressed: boolean;
  validationResult?: z.SafeParseReturnType<any, any>;
}

/**
 * Command to WebSocket message adapter
 */
export class CommandMessageAdapter {
  /**
   * Convert command to WebSocket message format
   */
  static toWebSocketMessage(command: Command): any {
    return {
      id: command.id,
      type: MessageType.COMMAND,
      payload: {
        commandType: command.commandType,
        parameters: command.parameters,
        metadata: command.metadata,
        priority: this.mapPriority(command.priority),
        timeoutMs: command.timeoutMs,
        maxRetries: command.maxRetries
      },
      timestamp: Date.now(),
      protocol: Protocol.JSON, // Will be updated by serializer
      compressed: false,
      acknowledged: false,
      priority: this.mapPriority(command.priority)
    };
  }

  /**
   * Convert WebSocket message to command format
   */
  static fromWebSocketMessage(message: any): Partial<Command> {
    const payload = message.payload || {};
    return {
      id: message.id,
      commandType: payload.commandType,
      priority: this.mapWebSocketPriority(payload.priority || message.priority),
      parameters: payload.parameters || {},
      metadata: payload.metadata || { source: 'websocket', tags: [], customData: {} },
      timeoutMs: payload.timeoutMs || 30000,
      maxRetries: payload.maxRetries || 0
    };
  }

  /**
   * Map command priority to WebSocket priority
   */
  private static mapPriority(priority: CommandPriority): Priority {
    switch (priority) {
      case CommandPriority.EMERGENCY:
        return Priority.CRITICAL;
      case CommandPriority.HIGH:
        return Priority.HIGH;
      case CommandPriority.NORMAL:
        return Priority.NORMAL;
      case CommandPriority.LOW:
        return Priority.LOW;
      default:
        return Priority.NORMAL;
    }
  }

  /**
   * Map WebSocket priority to command priority
   */
  private static mapWebSocketPriority(priority: Priority): CommandPriority {
    switch (priority) {
      case Priority.CRITICAL:
        return CommandPriority.EMERGENCY;
      case Priority.HIGH:
        return CommandPriority.HIGH;
      case Priority.NORMAL:
        return CommandPriority.NORMAL;
      case Priority.LOW:
        return CommandPriority.LOW;
      default:
        return CommandPriority.NORMAL;
    }
  }
}

/**
 * Command Serializer Service
 */
export class CommandSerializer {
  private validator: CommandValidator;
  private serializers: Map<Protocol, SerializerInterface> = new Map();

  constructor(validator?: CommandValidator) {
    this.validator = validator || new CommandValidator();
  }

  /**
   * Serialize a command
   */
  async serialize(
    command: Command | Partial<Command>,
    options: SerializationOptions = {}
  ): Promise<SerializationResult> {
    const {
      protocol = Protocol.MESSAGEPACK,
      compress = false,
      validate = true,
      includeMetadata = true
    } = options;

    // Validate command if requested
    let validationResult;
    if (validate) {
      try {
        validationResult = CommandSchema.safeParse(command);
        if (!validationResult.success) {
          throw new Error(`Validation failed: ${JSON.stringify(validationResult.error.errors)}`);
        }
      } catch (error) {
        throw new Error(`Command validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Prepare command data
    const commandData = this.prepareCommandData(command, includeMetadata);

    // Convert to WebSocket message format
    const wsMessage = CommandMessageAdapter.toWebSocketMessage(commandData as Command);
    wsMessage.protocol = protocol;
    wsMessage.compressed = compress;

    // Get serializer
    const serializer = this.getSerializer(protocol);

    // Serialize
    const data = serializer.encode(wsMessage);

    // Apply compression if requested
    const finalData = compress ? await this.compress(data) : data;

    return {
      data: finalData,
      protocol,
      size: finalData.byteLength,
      compressed: compress,
      validationResult
    };
  }

  /**
   * Deserialize command data
   */
  async deserialize(
    data: Uint8Array | ArrayBuffer,
    protocol: Protocol = Protocol.MESSAGEPACK,
    compressed: boolean = false
  ): Promise<Command | Partial<Command>> {
    // Decompress if needed
    const rawData = compressed ? await this.decompress(data) : data;

    // Get serializer
    const serializer = this.getSerializer(protocol);

    // Deserialize
    const wsMessage = serializer.decode(rawData);

    // Convert to command format
    const command = CommandMessageAdapter.fromWebSocketMessage(wsMessage);

    // Validate if we have a validator
    if (this.validator) {
      const validationResult = this.validator.validateCommand(command);
      if (!validationResult.valid) {
        console.warn('Deserialized command validation warnings:', validationResult.errors);
      }
    }

    return command;
  }

  /**
   * Serialize multiple commands as a batch
   */
  async serializeBatch(
    commands: Array<Command | Partial<Command>>,
    options: SerializationOptions = {}
  ): Promise<SerializationResult> {
    const batchMessage = {
      id: crypto.randomUUID(),
      type: MessageType.COMMAND,
      payload: {
        batch: true,
        commands: commands.map(cmd => ({
          commandType: cmd.commandType,
          parameters: cmd.parameters,
          metadata: cmd.metadata,
          priority: cmd.priority,
          timeoutMs: cmd.timeoutMs,
          maxRetries: cmd.maxRetries
        }))
      },
      timestamp: Date.now(),
      protocol: options.protocol || Protocol.MESSAGEPACK,
      compressed: options.compress || false,
      acknowledged: false,
      priority: Priority.NORMAL
    };

    const serializer = this.getSerializer(batchMessage.protocol);
    const data = serializer.encode(batchMessage);
    const finalData = options.compress ? await this.compress(data) : data;

    return {
      data: finalData,
      protocol: batchMessage.protocol,
      size: finalData.byteLength,
      compressed: options.compress || false
    };
  }

  /**
   * Estimate serialized size
   */
  estimateSize(
    command: Command | Partial<Command>,
    protocol: Protocol = Protocol.MESSAGEPACK
  ): number {
    const wsMessage = CommandMessageAdapter.toWebSocketMessage(command as Command);
    return SizeEstimator.estimate(wsMessage, protocol);
  }

  /**
   * Compare serialization efficiency
   */
  compareProtocols(command: Command | Partial<Command>): Record<Protocol, number> {
    const wsMessage = CommandMessageAdapter.toWebSocketMessage(command as Command);
    return SizeEstimator.compareProtocols(wsMessage);
  }

  /**
   * Get optimal protocol for command
   */
  getOptimalProtocol(command: Command | Partial<Command>): Protocol {
    const comparison = this.compareProtocols(command);
    let optimal = Protocol.JSON;
    let minSize = Infinity;

    Object.entries(comparison).forEach(([protocol, size]) => {
      if (size < minSize) {
        minSize = size;
        optimal = protocol as Protocol;
      }
    });

    return optimal;
  }

  /**
   * Prepare command data for serialization
   */
  private prepareCommandData(
    command: Command | Partial<Command>,
    includeMetadata: boolean
  ): Partial<Command> {
    const prepared: any = {
      id: command.id || crypto.randomUUID(),
      commandType: command.commandType,
      priority: command.priority || CommandPriority.NORMAL,
      parameters: command.parameters || {},
      timeoutMs: command.timeoutMs || 30000,
      maxRetries: command.maxRetries || 0
    };

    if (includeMetadata) {
      prepared.metadata = command.metadata || {
        source: 'frontend',
        tags: [],
        customData: {}
      };
      
      // Add execution state if present
      if (command.status) prepared.status = command.status;
      if (command.createdAt) prepared.createdAt = command.createdAt;
      if (command.queuedAt) prepared.queuedAt = command.queuedAt;
      if (command.startedAt) prepared.startedAt = command.startedAt;
      if (command.completedAt) prepared.completedAt = command.completedAt;
      if (command.retryCount !== undefined) prepared.retryCount = command.retryCount;
    }

    return prepared;
  }

  /**
   * Get or create serializer
   */
  private getSerializer(protocol: Protocol): SerializerInterface {
    if (!this.serializers.has(protocol)) {
      this.serializers.set(protocol, SerializerFactory.getSerializer(protocol));
    }
    return this.serializers.get(protocol)!;
  }

  /**
   * Compress data using CompressionStream API
   */
  private async compress(data: Uint8Array): Promise<Uint8Array> {
    if (!('CompressionStream' in window)) {
      console.warn('CompressionStream API not available, returning uncompressed data');
      return data;
    }

    try {
      const stream = new Response(data).body!
        .pipeThrough(new CompressionStream('gzip'));
      const compressed = await new Response(stream).arrayBuffer();
      return new Uint8Array(compressed);
    } catch (error) {
      console.error('Compression failed:', error);
      return data;
    }
  }

  /**
   * Decompress data using DecompressionStream API
   */
  private async decompress(data: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
    if (!('DecompressionStream' in window)) {
      console.warn('DecompressionStream API not available, returning data as-is');
      return data instanceof Uint8Array ? data : new Uint8Array(data);
    }

    try {
      const stream = new Response(data).body!
        .pipeThrough(new DecompressionStream('gzip'));
      const decompressed = await new Response(stream).arrayBuffer();
      return new Uint8Array(decompressed);
    } catch (error) {
      console.error('Decompression failed:', error);
      return data instanceof Uint8Array ? data : new Uint8Array(data);
    }
  }
}

/**
 * Global command serializer instance
 */
export const commandSerializer = new CommandSerializer();

/**
 * React hook for command serialization
 */
export function useCommandSerializer(validator?: CommandValidator) {
  const serializer = React.useMemo(() => {
    return new CommandSerializer(validator);
  }, [validator]);

  return serializer;
}