import { EventEmitter } from 'events';
import { Observable, Subject, BehaviorSubject, combineLatest, merge } from 'rxjs';
import { filter, map, throttleTime, debounceTime, buffer, scan, share } from 'rxjs/operators';

export interface TelemetryDataPoint {
  timestamp: number;
  channel: string;
  value: number | Record<string, number>;
  metadata?: Record<string, any>;
}

export interface DataSourceConfig {
  type: 'websocket' | 'rest' | 'kafka' | 'mqtt' | 'simulation';
  endpoint?: string;
  channels?: string[];
  refreshRate?: number;
  bufferSize?: number;
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'custom';
    credentials?: any;
  };
}

export interface DataBindingConfig {
  source: DataSourceConfig;
  transform?: DataTransformFunction;
  filter?: DataFilterFunction;
  aggregation?: AggregationConfig;
  normalization?: NormalizationConfig;
  validation?: ValidationConfig;
  errorHandling?: ErrorHandlingConfig;
}

export type DataTransformFunction = (data: TelemetryDataPoint) => TelemetryDataPoint | TelemetryDataPoint[] | null;
export type DataFilterFunction = (data: TelemetryDataPoint) => boolean;

export interface AggregationConfig {
  type: 'average' | 'sum' | 'min' | 'max' | 'count' | 'custom';
  windowSize: number;
  windowType: 'time' | 'count';
  customFunction?: (values: number[]) => number;
}

export interface NormalizationConfig {
  type: 'minmax' | 'zscore' | 'decimal' | 'custom';
  min?: number;
  max?: number;
  precision?: number;
  customFunction?: (value: number, context: any) => number;
}

export interface ValidationConfig {
  schema?: any;
  rules?: ValidationRule[];
  onInvalid?: 'skip' | 'error' | 'transform';
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'range' | 'type' | 'custom';
  params?: any;
  message?: string;
}

export interface ErrorHandlingConfig {
  retryAttempts?: number;
  retryDelay?: number;
  fallbackValue?: any;
  onError?: (error: Error) => void;
}

export interface DataSubscription {
  id: string;
  unsubscribe: () => void;
}

export interface ChartDataAdapter {
  channel: string;
  transform: (data: TelemetryDataPoint) => any;
  formatOptions?: any;
}

export abstract class DataSource extends EventEmitter {
  protected config: DataSourceConfig;
  protected dataSubject: Subject<TelemetryDataPoint> = new Subject();
  protected errorSubject: Subject<Error> = new Subject();
  protected connectionState: BehaviorSubject<'disconnected' | 'connecting' | 'connected' | 'error'> = 
    new BehaviorSubject<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  constructor(config: DataSourceConfig) {
    super();
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract subscribeToChannel(channel: string): void;
  abstract unsubscribeFromChannel(channel: string): void;

  get data$(): Observable<TelemetryDataPoint> {
    return this.dataSubject.asObservable();
  }

  get errors$(): Observable<Error> {
    return this.errorSubject.asObservable();
  }

  get connectionState$(): Observable<'disconnected' | 'connecting' | 'connected' | 'error'> {
    return this.connectionState.asObservable();
  }

  protected emitData(data: TelemetryDataPoint): void {
    this.dataSubject.next(data);
    this.emit('data', data);
  }

  protected emitError(error: Error): void {
    this.errorSubject.next(error);
    this.emit('error', error);
  }
}

export class DataBindingLayer {
  private dataSources: Map<string, DataSource> = new Map();
  private bindings: Map<string, DataBinding> = new Map();
  private subscriptions: Map<string, DataSubscription[]> = new Map();

  async createDataSource(id: string, config: DataSourceConfig): Promise<DataSource> {
    if (this.dataSources.has(id)) {
      throw new Error(`Data source with id ${id} already exists`);
    }

    const dataSource = this.createDataSourceInstance(config);
    this.dataSources.set(id, dataSource);
    
    await dataSource.connect();
    return dataSource;
  }

  private createDataSourceInstance(config: DataSourceConfig): DataSource {
    switch (config.type) {
      case 'websocket':
        return new WebSocketDataSource(config);
      case 'rest':
        return new RestDataSource(config);
      case 'kafka':
        return new KafkaDataSource(config);
      case 'mqtt':
        return new MqttDataSource(config);
      case 'simulation':
        return new SimulationDataSource(config);
      default:
        throw new Error(`Unknown data source type: ${config.type}`);
    }
  }

  async removeDataSource(id: string): Promise<void> {
    const dataSource = this.dataSources.get(id);
    if (!dataSource) {
      throw new Error(`Data source with id ${id} not found`);
    }

    // Remove all bindings associated with this data source
    for (const [bindingId, binding] of this.bindings.entries()) {
      if (binding.dataSourceId === id) {
        this.unbind(bindingId);
      }
    }

    await dataSource.disconnect();
    this.dataSources.delete(id);
  }

  createBinding(id: string, config: DataBindingConfig, dataSourceId: string): DataBinding {
    if (this.bindings.has(id)) {
      throw new Error(`Binding with id ${id} already exists`);
    }

    const dataSource = this.dataSources.get(dataSourceId);
    if (!dataSource) {
      throw new Error(`Data source with id ${dataSourceId} not found`);
    }

    const binding = new DataBinding(id, config, dataSource, dataSourceId);
    this.bindings.set(id, binding);
    return binding;
  }

  bind(bindingId: string, chartAdapter: ChartDataAdapter, callback: (data: any) => void): DataSubscription {
    const binding = this.bindings.get(bindingId);
    if (!binding) {
      throw new Error(`Binding with id ${bindingId} not found`);
    }

    const subscription = binding.subscribe(chartAdapter, callback);
    
    if (!this.subscriptions.has(bindingId)) {
      this.subscriptions.set(bindingId, []);
    }
    this.subscriptions.get(bindingId)!.push(subscription);

    return subscription;
  }

  unbind(bindingId: string): void {
    const subscriptions = this.subscriptions.get(bindingId);
    if (subscriptions) {
      subscriptions.forEach(sub => sub.unsubscribe());
      this.subscriptions.delete(bindingId);
    }

    const binding = this.bindings.get(bindingId);
    if (binding) {
      binding.destroy();
      this.bindings.delete(bindingId);
    }
  }

  getDataSource(id: string): DataSource | undefined {
    return this.dataSources.get(id);
  }

  getBinding(id: string): DataBinding | undefined {
    return this.bindings.get(id);
  }

  getAllDataSources(): Map<string, DataSource> {
    return new Map(this.dataSources);
  }

  getAllBindings(): Map<string, DataBinding> {
    return new Map(this.bindings);
  }
}

export class DataBinding {
  private pipeline: Observable<TelemetryDataPoint>;
  private subscriptions: Map<string, any> = new Map();
  private aggregationBuffer: Map<string, number[]> = new Map();
  private lastAggregationTime: Map<string, number> = new Map();

  constructor(
    public readonly id: string,
    private config: DataBindingConfig,
    private dataSource: DataSource,
    public readonly dataSourceId: string
  ) {
    this.pipeline = this.createPipeline();
  }

  private createPipeline(): Observable<TelemetryDataPoint> {
    let pipeline = this.dataSource.data$;

    // Apply validation
    if (this.config.validation) {
      pipeline = pipeline.pipe(
        map(data => this.validateData(data)),
        filter(data => data !== null)
      ) as Observable<TelemetryDataPoint>;
    }

    // Apply filter
    if (this.config.filter) {
      pipeline = pipeline.pipe(filter(this.config.filter));
    }

    // Apply transformation
    if (this.config.transform) {
      pipeline = pipeline.pipe(
        map(this.config.transform),
        filter(data => data !== null),
        // Flatten if transform returns array
        map(data => Array.isArray(data) ? data : [data]),
        map(dataArray => dataArray[0]) // For now, just take first item
      ) as Observable<TelemetryDataPoint>;
    }

    // Apply normalization
    if (this.config.normalization) {
      pipeline = pipeline.pipe(
        map(data => this.normalizeData(data))
      );
    }

    // Apply aggregation
    if (this.config.aggregation) {
      pipeline = this.applyAggregation(pipeline);
    }

    // Share the pipeline to avoid multiple subscriptions
    return pipeline.pipe(share());
  }

  private validateData(data: TelemetryDataPoint): TelemetryDataPoint | null {
    if (!this.config.validation) return data;

    const { rules, onInvalid = 'skip' } = this.config.validation;
    
    if (rules) {
      for (const rule of rules) {
        if (!this.validateRule(data, rule)) {
          switch (onInvalid) {
            case 'skip':
              return null;
            case 'error':
              throw new Error(rule.message || `Validation failed for rule: ${rule.type}`);
            case 'transform':
              // Apply transformation logic here
              return data;
          }
        }
      }
    }

    return data;
  }

  private validateRule(data: TelemetryDataPoint, rule: ValidationRule): boolean {
    switch (rule.type) {
      case 'required':
        return data[rule.field as keyof TelemetryDataPoint] !== undefined;
      case 'range':
        const value = data[rule.field as keyof TelemetryDataPoint];
        if (typeof value === 'number') {
          return value >= rule.params.min && value <= rule.params.max;
        }
        return false;
      case 'type':
        return typeof data[rule.field as keyof TelemetryDataPoint] === rule.params.type;
      case 'custom':
        return rule.params.function(data);
      default:
        return true;
    }
  }

  private normalizeData(data: TelemetryDataPoint): TelemetryDataPoint {
    if (!this.config.normalization) return data;

    const { type, min = 0, max = 1, precision = 2, customFunction } = this.config.normalization;
    
    if (typeof data.value === 'number') {
      let normalizedValue: number;

      switch (type) {
        case 'minmax':
          normalizedValue = (data.value - min) / (max - min);
          break;
        case 'zscore':
          // Simplified z-score normalization
          normalizedValue = data.value; // Would need mean and std dev
          break;
        case 'decimal':
          normalizedValue = Number(data.value.toFixed(precision));
          break;
        case 'custom':
          normalizedValue = customFunction ? customFunction(data.value, data) : data.value;
          break;
        default:
          normalizedValue = data.value;
      }

      return { ...data, value: normalizedValue };
    }

    return data;
  }

  private applyAggregation(pipeline: Observable<TelemetryDataPoint>): Observable<TelemetryDataPoint> {
    if (!this.config.aggregation) return pipeline;

    const { type, windowSize, windowType } = this.config.aggregation;

    if (windowType === 'time') {
      return pipeline.pipe(
        buffer(pipeline.pipe(debounceTime(windowSize))),
        filter(buffer => buffer.length > 0),
        map(buffer => this.aggregateData(buffer, type))
      );
    } else {
      return pipeline.pipe(
        buffer(pipeline.pipe(scan((acc, val) => acc + 1, 0), filter(count => count % windowSize === 0))),
        filter(buffer => buffer.length > 0),
        map(buffer => this.aggregateData(buffer, type))
      );
    }
  }

  private aggregateData(buffer: TelemetryDataPoint[], aggregationType: string): TelemetryDataPoint {
    const values = buffer.map(d => typeof d.value === 'number' ? d.value : 0);
    const latestPoint = buffer[buffer.length - 1];
    
    let aggregatedValue: number;

    switch (aggregationType) {
      case 'average':
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      case 'custom':
        aggregatedValue = this.config.aggregation?.customFunction?.(values) || 0;
        break;
      default:
        aggregatedValue = values[values.length - 1];
    }

    return {
      ...latestPoint,
      value: aggregatedValue,
      metadata: {
        ...latestPoint.metadata,
        aggregation: {
          type: aggregationType,
          count: buffer.length,
          windowSize: this.config.aggregation?.windowSize
        }
      }
    };
  }

  subscribe(adapter: ChartDataAdapter, callback: (data: any) => void): DataSubscription {
    const id = `${Date.now()}-${Math.random()}`;
    
    const subscription = this.pipeline
      .pipe(
        filter(data => data.channel === adapter.channel),
        map(data => adapter.transform(data))
      )
      .subscribe({
        next: callback,
        error: (error) => {
          if (this.config.errorHandling?.onError) {
            this.config.errorHandling.onError(error);
          }
        }
      });

    this.subscriptions.set(id, subscription);

    return {
      id,
      unsubscribe: () => {
        subscription.unsubscribe();
        this.subscriptions.delete(id);
      }
    };
  }

  destroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
    this.aggregationBuffer.clear();
    this.lastAggregationTime.clear();
  }
}

// Data Source Implementations
class WebSocketDataSource extends DataSource {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscribedChannels: Set<string> = new Set();

  async connect(): Promise<void> {
    this.connectionState.next('connecting');
    
    try {
      this.ws = new WebSocket(this.config.endpoint || 'ws://localhost:8080');
      
      this.ws.onopen = () => {
        this.connectionState.next('connected');
        // Resubscribe to channels after reconnection
        this.subscribedChannels.forEach(channel => {
          this.sendSubscription(channel);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emitData(data);
        } catch (error) {
          this.emitError(new Error(`Failed to parse WebSocket message: ${error}`));
        }
      };

      this.ws.onerror = (error) => {
        this.connectionState.next('error');
        this.emitError(new Error(`WebSocket error: ${error}`));
      };

      this.ws.onclose = () => {
        this.connectionState.next('disconnected');
        this.scheduleReconnect();
      };

    } catch (error) {
      this.connectionState.next('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionState.next('disconnected');
  }

  subscribeToChannel(channel: string): void {
    this.subscribedChannels.add(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(channel);
    }
  }

  unsubscribeFromChannel(channel: string): void {
    this.subscribedChannels.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscription(channel);
    }
  }

  private sendSubscription(channel: string): void {
    this.ws?.send(JSON.stringify({ type: 'subscribe', channel }));
  }

  private sendUnsubscription(channel: string): void {
    this.ws?.send(JSON.stringify({ type: 'unsubscribe', channel }));
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().catch(error => {
          this.emitError(error);
          this.scheduleReconnect();
        });
      }, 5000);
    }
  }
}

class RestDataSource extends DataSource {
  private pollInterval: NodeJS.Timeout | null = null;
  private subscribedChannels: Set<string> = new Set();

  async connect(): Promise<void> {
    this.connectionState.next('connecting');
    
    try {
      // Start polling
      const refreshRate = this.config.refreshRate || 1000;
      
      this.pollInterval = setInterval(() => {
        this.fetchData();
      }, refreshRate);

      this.connectionState.next('connected');
    } catch (error) {
      this.connectionState.next('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.connectionState.next('disconnected');
  }

  subscribeToChannel(channel: string): void {
    this.subscribedChannels.add(channel);
  }

  unsubscribeFromChannel(channel: string): void {
    this.subscribedChannels.delete(channel);
  }

  private async fetchData(): Promise<void> {
    try {
      for (const channel of this.subscribedChannels) {
        const response = await fetch(`${this.config.endpoint}/${channel}`);
        const data = await response.json();
        
        this.emitData({
          timestamp: Date.now(),
          channel,
          value: data.value,
          metadata: data.metadata
        });
      }
    } catch (error) {
      this.emitError(error as Error);
    }
  }
}

class KafkaDataSource extends DataSource {
  // Placeholder implementation
  async connect(): Promise<void> {
    this.connectionState.next('connected');
  }

  async disconnect(): Promise<void> {
    this.connectionState.next('disconnected');
  }

  subscribeToChannel(channel: string): void {
    // Implement Kafka topic subscription
  }

  unsubscribeFromChannel(channel: string): void {
    // Implement Kafka topic unsubscription
  }
}

class MqttDataSource extends DataSource {
  // Placeholder implementation
  async connect(): Promise<void> {
    this.connectionState.next('connected');
  }

  async disconnect(): Promise<void> {
    this.connectionState.next('disconnected');
  }

  subscribeToChannel(channel: string): void {
    // Implement MQTT topic subscription
  }

  unsubscribeFromChannel(channel: string): void {
    // Implement MQTT topic unsubscription
  }
}

class SimulationDataSource extends DataSource {
  private simulationTimer: NodeJS.Timeout | null = null;
  private subscribedChannels: Set<string> = new Set();

  async connect(): Promise<void> {
    this.connectionState.next('connecting');
    
    // Start simulation
    const refreshRate = this.config.refreshRate || 100;
    
    this.simulationTimer = setInterval(() => {
      this.generateSimulatedData();
    }, refreshRate);

    this.connectionState.next('connected');
  }

  async disconnect(): Promise<void> {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }

    this.connectionState.next('disconnected');
  }

  subscribeToChannel(channel: string): void {
    this.subscribedChannels.add(channel);
  }

  unsubscribeFromChannel(channel: string): void {
    this.subscribedChannels.delete(channel);
  }

  private generateSimulatedData(): void {
    for (const channel of this.subscribedChannels) {
      const value = this.generateValueForChannel(channel);
      
      this.emitData({
        timestamp: Date.now(),
        channel,
        value,
        metadata: {
          simulated: true
        }
      });
    }
  }

  private generateValueForChannel(channel: string): number {
    // Generate different patterns based on channel name
    const time = Date.now() / 1000;
    
    if (channel.includes('temperature')) {
      return 20 + 5 * Math.sin(time / 10) + Math.random() * 2;
    } else if (channel.includes('speed')) {
      return Math.max(0, 50 + 20 * Math.sin(time / 5) + Math.random() * 5);
    } else if (channel.includes('battery')) {
      return Math.max(0, Math.min(100, 80 - (time % 3600) / 36));
    } else {
      return Math.random() * 100;
    }
  }
}