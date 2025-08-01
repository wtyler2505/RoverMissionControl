/**
 * Command History Service with caching and performance optimization
 * Provides access to command history, audit logs, and metrics
 */

import { apiClient } from './api';
import { 
  CommandHistory, 
  CommandHistoryFilter, 
  CommandHistoryResponse,
  HistoryStatistics,
  MetricsResponse,
  ExportFormat,
  ExportRequest,
  AuditLogResponse,
  TimeInterval,
  SortOrder
} from '../types/command-history.types';

// Cache configuration
const CACHE_CONFIG = {
  HISTORY_TTL: 60000, // 1 minute
  STATS_TTL: 300000, // 5 minutes
  METRICS_TTL: 120000, // 2 minutes
  MAX_CACHE_SIZE: 100 // Maximum number of cached queries
};

// Cache implementation
class CacheManager<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private accessOrder: string[] = [];

  constructor(private ttl: number, private maxSize: number) {}

  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);
    return cached.data;
  }

  set(key: string, data: T): void {
    // Evict least recently used if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }

    this.cache.set(key, { data, timestamp: Date.now() });
    this.updateAccessOrder(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  private updateAccessOrder(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }
}

// Service class
class CommandHistoryService {
  private historyCache = new CacheManager<CommandHistoryResponse>(
    CACHE_CONFIG.HISTORY_TTL,
    CACHE_CONFIG.MAX_CACHE_SIZE
  );
  
  private statsCache = new CacheManager<HistoryStatistics>(
    CACHE_CONFIG.STATS_TTL,
    10
  );
  
  private metricsCache = new CacheManager<MetricsResponse[]>(
    CACHE_CONFIG.METRICS_TTL,
    20
  );

  /**
   * Get command history with filters
   */
  async getCommandHistory(
    filters: CommandHistoryFilter,
    page: number = 1,
    pageSize: number = 50,
    sortBy: string = 'created_at',
    sortOrder: SortOrder = SortOrder.DESC
  ): Promise<CommandHistoryResponse> {
    // Generate cache key
    const cacheKey = JSON.stringify({ filters, page, pageSize, sortBy, sortOrder });
    
    // Check cache
    const cached = this.historyCache.get(cacheKey);
    if (cached) return cached;

    // Build query parameters
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    params.append('sort_by', sortBy);
    params.append('sort_order', sortOrder);

    // Add filters
    if (filters.startTime) params.append('start_time', filters.startTime.toISOString());
    if (filters.endTime) params.append('end_time', filters.endTime.toISOString());
    if (filters.commandTypes?.length) {
      filters.commandTypes.forEach(type => params.append('command_types', type));
    }
    if (filters.priorities?.length) {
      filters.priorities.forEach(p => params.append('priorities', p.toString()));
    }
    if (filters.statuses?.length) {
      filters.statuses.forEach(status => params.append('statuses', status));
    }
    if (filters.userIds?.length) {
      filters.userIds.forEach(id => params.append('user_ids', id));
    }
    if (filters.onlyErrors) params.append('only_errors', 'true');
    if (filters.searchText) params.append('search_text', filters.searchText);
    if (filters.tags?.length) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }

    const response = await apiClient.get<CommandHistoryResponse>(
      `/command-history?${params.toString()}`
    );

    // Cache the response
    this.historyCache.set(cacheKey, response.data);

    return response.data;
  }

  /**
   * Get detailed command information with audit trail
   */
  async getCommandDetails(
    commandId: string,
    includeAuditTrail: boolean = true
  ): Promise<{ command: CommandHistory; auditTrail: AuditLogResponse[] }> {
    const params = new URLSearchParams();
    params.append('include_audit_trail', includeAuditTrail.toString());

    const response = await apiClient.get(
      `/command-history/${commandId}?${params.toString()}`
    );

    return response.data;
  }

  /**
   * Get aggregated statistics
   */
  async getStatistics(
    startTime?: Date,
    endTime?: Date,
    commandTypes?: string[]
  ): Promise<HistoryStatistics> {
    const cacheKey = JSON.stringify({ startTime, endTime, commandTypes });
    
    const cached = this.statsCache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (startTime) params.append('start_time', startTime.toISOString());
    if (endTime) params.append('end_time', endTime.toISOString());
    if (commandTypes?.length) {
      commandTypes.forEach(type => params.append('command_types', type));
    }

    const response = await apiClient.get<HistoryStatistics>(
      `/command-history/statistics/summary?${params.toString()}`
    );

    this.statsCache.set(cacheKey, response.data);
    return response.data;
  }

  /**
   * Get time-series metrics
   */
  async getMetrics(
    interval: TimeInterval = TimeInterval.HOUR,
    startTime?: Date,
    endTime?: Date,
    commandTypes?: string[]
  ): Promise<MetricsResponse[]> {
    const cacheKey = JSON.stringify({ interval, startTime, endTime, commandTypes });
    
    const cached = this.metricsCache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams();
    params.append('interval', interval);
    if (startTime) params.append('start_time', startTime.toISOString());
    if (endTime) params.append('end_time', endTime.toISOString());
    if (commandTypes?.length) {
      commandTypes.forEach(type => params.append('command_types', type));
    }

    const response = await apiClient.get<MetricsResponse[]>(
      `/command-history/metrics/time-series?${params.toString()}`
    );

    this.metricsCache.set(cacheKey, response.data);
    return response.data;
  }

  /**
   * Export command history
   */
  async exportHistory(
    exportRequest: ExportRequest
  ): Promise<{ url: string; filename: string }> {
    const response = await apiClient.post<{ url: string; filename: string }>(
      '/command-history/export',
      exportRequest
    );

    // Handle file download
    if (response.data.url) {
      this.downloadFile(response.data.url, response.data.filename);
    }

    return response.data;
  }

  /**
   * Search command history with advanced options
   */
  async searchHistory(
    query: string,
    searchFields: string[] = ['command_type', 'error_code', 'tags'],
    fuzzyMatch: boolean = false,
    maxResults: number = 100
  ): Promise<CommandHistory[]> {
    const response = await apiClient.post<CommandHistory[]>(
      '/command-history/search',
      {
        query,
        search_fields: searchFields,
        use_fuzzy_matching: fuzzyMatch,
        max_results: maxResults
      }
    );

    return response.data;
  }

  /**
   * Apply retention policies (admin only)
   */
  async applyRetentionPolicies(
    dryRun: boolean = true
  ): Promise<{
    dryRun: boolean;
    totalAffected: number;
    policyResults: Array<{
      policyName: string;
      matches: number;
      action: string;
    }>;
  }> {
    const response = await apiClient.delete(
      `/command-history/retention/apply?dry_run=${dryRun}`
    );

    return response.data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.historyCache.clear();
    this.statsCache.clear();
    this.metricsCache.clear();
  }

  /**
   * Subscribe to real-time history updates
   */
  subscribeToUpdates(
    callback: (update: CommandHistory) => void
  ): () => void {
    // Implementation would connect to WebSocket for real-time updates
    // Return unsubscribe function
    return () => {
      // Cleanup WebSocket connection
    };
  }

  /**
   * Download file helper
   */
  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Get command types for filtering
   */
  async getAvailableCommandTypes(): Promise<string[]> {
    const stats = await this.getStatistics();
    return Object.keys(stats.commandTypeDistribution);
  }

  /**
   * Get error codes for filtering
   */
  async getAvailableErrorCodes(): Promise<string[]> {
    // This would be implemented based on backend endpoint
    return ['TIMEOUT', 'INVALID_PARAMS', 'HARDWARE_ERROR', 'NETWORK_ERROR'];
  }
}

// Export singleton instance
export const commandHistoryService = new CommandHistoryService();

// Export types
export type { 
  CommandHistory, 
  CommandHistoryFilter, 
  CommandHistoryResponse,
  HistoryStatistics,
  MetricsResponse 
};