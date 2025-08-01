/**
 * HistoricalDataManager - Backend API integration for historical telemetry data
 * Handles data caching, pagination, and efficient retrieval of historical telemetry
 */

import { TypedEventEmitter as EventEmitter } from '../websocket/EventEmitter';
import { TelemetryDataPoint, TelemetryStreamConfig } from '../websocket/TelemetryManager';

/**
 * Historical data query parameters
 */
export interface HistoricalDataQuery {
  streamId: string;
  startTime: number;
  endTime: number;
  resolution?: number;          // Data points per time unit
  aggregationType?: AggregationType;
  pageSize?: number;
  pageToken?: string;
}

/**
 * Aggregation types for data reduction
 */
export enum AggregationType {
  NONE = 'none',
  AVERAGE = 'average',
  MIN = 'min',
  MAX = 'max',
  FIRST = 'first',
  LAST = 'last',
  COUNT = 'count',
  SUM = 'sum',
  STDDEV = 'stddev'
}

/**
 * Historical data response from backend
 */
export interface HistoricalDataResponse {
  streamId: string;
  data: TelemetryDataPoint[];
  metadata: {
    startTime: number;
    endTime: number;
    totalPoints: number;
    returnedPoints: number;
    aggregationType?: AggregationType;
    resolution?: number;
  };
  pagination?: {
    hasMore: boolean;
    nextPageToken?: string;
    totalPages?: number;
    currentPage?: number;
  };
}

/**
 * Cache entry for historical data
 */
interface CacheEntry {
  query: HistoricalDataQuery;
  response: HistoricalDataResponse;
  timestamp: number;
  size: number;
}

/**
 * Export format options
 */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  PARQUET = 'parquet',
  XLSX = 'xlsx'
}

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  streamIds: string[];
  startTime: number;
  endTime: number;
  includeMetadata?: boolean;
  compression?: boolean;
  fileName?: string;
}

/**
 * Historical data manager events
 */
export interface HistoricalDataManagerEvents {
  'data:loaded': (response: HistoricalDataResponse) => void;
  'data:loading': (query: HistoricalDataQuery) => void;
  'data:error': (error: Error, query: HistoricalDataQuery) => void;
  'cache:hit': (query: HistoricalDataQuery) => void;
  'cache:miss': (query: HistoricalDataQuery) => void;
  'cache:evicted': (entries: number) => void;
  'export:progress': (progress: number) => void;
  'export:complete': (url: string) => void;
  'export:error': (error: Error) => void;
}

/**
 * LRU Cache implementation for historical data
 */
class HistoricalDataCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private currentSize = 0;
  private readonly maxSize: number;
  private readonly maxAge: number;

  constructor(maxSizeMB: number = 100, maxAgeMs: number = 3600000) {
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    this.maxAge = maxAgeMs;
  }

  get(query: HistoricalDataQuery): HistoricalDataResponse | null {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.remove(key);
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    return entry.response;
  }

  set(query: HistoricalDataQuery, response: HistoricalDataResponse): void {
    const key = this.generateKey(query);
    const size = this.estimateSize(response);

    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.remove(key);
    }

    // Evict entries if needed
    while (this.currentSize + size > this.maxSize && this.accessOrder.length > 0) {
      this.evictLRU();
    }

    // Add new entry
    const entry: CacheEntry = {
      query,
      response,
      timestamp: Date.now(),
      size
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.currentSize += size;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
  }

  getStats(): {
    entries: number;
    size: number;
    hitRate: number;
  } {
    // Calculate hit rate would require tracking hits/misses
    return {
      entries: this.cache.size,
      size: this.currentSize,
      hitRate: 0 // Placeholder
    };
  }

  private generateKey(query: HistoricalDataQuery): string {
    return `${query.streamId}-${query.startTime}-${query.endTime}-${query.resolution}-${query.aggregationType}`;
  }

  private estimateSize(response: HistoricalDataResponse): number {
    // Rough estimation: 50 bytes per data point + metadata
    return response.data.length * 50 + 1000;
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private evictLRU(): void {
    const key = this.accessOrder.shift();
    if (key) {
      this.remove(key);
    }
  }

  private remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }
}

/**
 * HistoricalDataManager - Main class for managing historical telemetry data
 */
export class HistoricalDataManager extends EventEmitter<HistoricalDataManagerEvents> {
  private cache: HistoricalDataCache;
  private activeRequests = new Map<string, AbortController>();
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string = '/api/v1/telemetry/historical') {
    super();
    this.baseUrl = baseUrl;
    this.cache = new HistoricalDataCache();
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Query historical data
   */
  async queryData(query: HistoricalDataQuery): Promise<HistoricalDataResponse> {
    const cacheKey = this.generateRequestKey(query);

    // Check cache first
    const cached = this.cache.get(query);
    if (cached) {
      this.emit('cache:hit', query);
      return cached;
    }

    this.emit('cache:miss', query);
    this.emit('data:loading', query);

    // Create abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(cacheKey, abortController);

    try {
      const response = await this.fetchHistoricalData(query, abortController.signal);
      
      // Cache the response
      this.cache.set(query, response);
      
      this.emit('data:loaded', response);
      return response;
    } catch (error) {
      this.emit('data:error', error as Error, query);
      throw error;
    } finally {
      this.activeRequests.delete(cacheKey);
    }
  }

  /**
   * Query multiple streams in parallel
   */
  async queryMultipleStreams(
    streamIds: string[],
    startTime: number,
    endTime: number,
    options?: Partial<HistoricalDataQuery>
  ): Promise<Map<string, HistoricalDataResponse>> {
    const queries = streamIds.map(streamId => ({
      streamId,
      startTime,
      endTime,
      ...options
    }));

    const results = await Promise.allSettled(
      queries.map(query => this.queryData(query))
    );

    const responseMap = new Map<string, HistoricalDataResponse>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        responseMap.set(streamIds[index], result.value);
      }
    });

    return responseMap;
  }

  /**
   * Stream paginated data
   */
  async *streamPaginatedData(
    query: HistoricalDataQuery
  ): AsyncGenerator<HistoricalDataResponse> {
    let pageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const pagedQuery = { ...query, pageToken };
      const response = await this.queryData(pagedQuery);
      
      yield response;

      hasMore = response.pagination?.hasMore || false;
      pageToken = response.pagination?.nextPageToken;
    }
  }

  /**
   * Export historical data
   */
  async exportData(options: ExportOptions): Promise<string> {
    const exportUrl = `${this.baseUrl}/export`;
    
    try {
      const response = await fetch(exportUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const { exportId } = await response.json();
      
      // Poll for export completion
      return await this.pollExportStatus(exportId);
    } catch (error) {
      this.emit('export:error', error as Error);
      throw error;
    }
  }

  /**
   * Get data statistics for a time range
   */
  async getDataStatistics(
    streamId: string,
    startTime: number,
    endTime: number
  ): Promise<{
    count: number;
    min: number;
    max: number;
    average: number;
    stddev: number;
    gaps: Array<{ start: number; end: number }>;
  }> {
    const url = `${this.baseUrl}/statistics`;
    const params = new URLSearchParams({
      streamId,
      startTime: startTime.toString(),
      endTime: endTime.toString()
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Statistics query failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Prefetch data for a time range
   */
  async prefetchData(
    streamIds: string[],
    startTime: number,
    endTime: number,
    resolution?: number
  ): Promise<void> {
    const promises = streamIds.map(streamId =>
      this.queryData({
        streamId,
        startTime,
        endTime,
        resolution,
        aggregationType: resolution ? AggregationType.AVERAGE : AggregationType.NONE
      }).catch(error => {
        console.error(`Failed to prefetch ${streamId}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Cancel active requests
   */
  cancelActiveRequests(): void {
    for (const [key, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): ReturnType<HistoricalDataCache['getStats']> {
    return this.cache.getStats();
  }

  private async fetchHistoricalData(
    query: HistoricalDataQuery,
    signal: AbortSignal
  ): Promise<HistoricalDataResponse> {
    const url = new URL(this.baseUrl);
    
    // Add query parameters
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
      signal
    });

    if (!response.ok) {
      throw new Error(`Historical data query failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private async pollExportStatus(exportId: string): Promise<string> {
    const statusUrl = `${this.baseUrl}/export/${exportId}/status`;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5 second intervals

    while (attempts < maxAttempts) {
      const response = await fetch(statusUrl, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Export status check failed: ${response.statusText}`);
      }

      const { status, progress, downloadUrl, error } = await response.json();

      if (status === 'completed' && downloadUrl) {
        this.emit('export:complete', downloadUrl);
        return downloadUrl;
      }

      if (status === 'failed') {
        throw new Error(error || 'Export failed');
      }

      this.emit('export:progress', progress || 0);
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Export timeout');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private generateRequestKey(query: HistoricalDataQuery): string {
    return `${query.streamId}-${query.startTime}-${query.endTime}`;
  }
}