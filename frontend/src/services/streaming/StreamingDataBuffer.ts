/**
 * StreamingDataBuffer - High-performance circular buffer for streaming data
 * Optimized for real-time telemetry visualization with time-based windowing
 */

import { TelemetryDataPoint } from '../websocket/TelemetryManager';
import { 
  StreamingDataBuffer as IStreamingDataBuffer, 
  BufferStatistics,
  StreamingBufferConfig 
} from '../../types/streaming';

/**
 * Binary search for timestamp in sorted array
 */
function binarySearch(arr: TelemetryDataPoint[], timestamp: number): number {
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid].timestamp < timestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return left;
}

/**
 * Adaptive compression for high-frequency data
 */
class DataCompressor {
  private compressionRatio = 1;
  private readonly threshold: number;
  
  constructor(threshold: number = 10000) {
    this.threshold = threshold;
  }
  
  compress(points: TelemetryDataPoint[]): TelemetryDataPoint[] {
    if (points.length < this.threshold) {
      this.compressionRatio = 1;
      return points;
    }
    
    // Use Largest Triangle Three Buckets (LTTB) algorithm
    const targetSize = Math.floor(this.threshold * 0.8);
    const compressed = this.lttb(points, targetSize);
    this.compressionRatio = points.length / compressed.length;
    
    return compressed;
  }
  
  private lttb(data: TelemetryDataPoint[], targetSize: number): TelemetryDataPoint[] {
    if (targetSize >= data.length || targetSize === 0) {
      return data;
    }
    
    const sampled: TelemetryDataPoint[] = [];
    const bucketSize = (data.length - 2) / (targetSize - 2);
    
    // Always add first point
    sampled.push(data[0]);
    
    // Add middle points
    for (let i = 0; i < targetSize - 2; i++) {
      const avgStart = Math.floor((i + 0) * bucketSize) + 1;
      const avgEnd = Math.floor((i + 1) * bucketSize) + 1;
      const nextAvgStart = Math.floor((i + 1) * bucketSize) + 1;
      const nextAvgEnd = Math.floor((i + 2) * bucketSize) + 1;
      
      // Calculate average for next bucket
      let avgX = 0, avgY = 0;
      const nextAvgEnd2 = Math.min(nextAvgEnd, data.length);
      for (let j = nextAvgStart; j < nextAvgEnd2; j++) {
        avgX += data[j].timestamp;
        avgY += typeof data[j].value === 'number' ? data[j].value : 0;
      }
      avgX /= nextAvgEnd2 - nextAvgStart;
      avgY /= nextAvgEnd2 - nextAvgStart;
      
      // Find point with largest triangle area
      let maxArea = -1;
      let maxAreaPoint = data[avgStart];
      const a = data[sampled.length - 1];
      
      for (let j = avgStart; j < avgEnd && j < data.length; j++) {
        const point = data[j];
        const pointY = typeof point.value === 'number' ? point.value : 0;
        const area = Math.abs(
          (a.timestamp - avgX) * (pointY - a.value) -
          (a.timestamp - point.timestamp) * (avgY - a.value)
        ) * 0.5;
        
        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = point;
        }
      }
      
      sampled.push(maxAreaPoint);
    }
    
    // Always add last point
    sampled.push(data[data.length - 1]);
    
    return sampled;
  }
  
  getCompressionRatio(): number {
    return this.compressionRatio;
  }
}

/**
 * High-performance streaming data buffer implementation
 */
export class StreamingDataBuffer implements IStreamingDataBuffer {
  private data: TelemetryDataPoint[] = [];
  private readonly config: StreamingBufferConfig;
  private compressor?: DataCompressor;
  private lastTrimTime = 0;
  private stats: BufferStatistics = {
    count: 0,
    oldestTimestamp: 0,
    newestTimestamp: 0,
    averageInterval: 0,
    utilization: 0
  };
  
  constructor(config: StreamingBufferConfig) {
    this.config = config;
    
    if (config.compressionThreshold) {
      this.compressor = new DataCompressor(config.compressionThreshold);
    }
  }
  
  get capacity(): number {
    return this.config.capacity;
  }
  
  get size(): number {
    return this.data.length;
  }
  
  get windowSize(): number {
    return this.config.windowSize;
  }
  
  push(point: TelemetryDataPoint): void {
    // Insert in sorted order (by timestamp)
    const insertIndex = binarySearch(this.data, point.timestamp);
    this.data.splice(insertIndex, 0, point);
    
    // Trim old data
    this.trimIfNeeded();
    
    // Update statistics
    this.updateStats();
  }
  
  pushBatch(points: TelemetryDataPoint[]): void {
    if (points.length === 0) return;
    
    // Sort incoming points
    const sorted = points.slice().sort((a, b) => a.timestamp - b.timestamp);
    
    // Merge with existing data
    const merged: TelemetryDataPoint[] = [];
    let i = 0, j = 0;
    
    while (i < this.data.length && j < sorted.length) {
      if (this.data[i].timestamp <= sorted[j].timestamp) {
        merged.push(this.data[i++]);
      } else {
        merged.push(sorted[j++]);
      }
    }
    
    // Add remaining
    while (i < this.data.length) merged.push(this.data[i++]);
    while (j < sorted.length) merged.push(sorted[j++]);
    
    this.data = merged;
    
    // Trim and compress
    this.trimIfNeeded();
    this.compressIfNeeded();
    
    // Update statistics
    this.updateStats();
  }
  
  getRange(startTime: number, endTime: number): TelemetryDataPoint[] {
    if (this.data.length === 0) return [];
    
    const startIndex = binarySearch(this.data, startTime);
    const endIndex = binarySearch(this.data, endTime);
    
    return this.data.slice(startIndex, endIndex);
  }
  
  getLatest(count: number): TelemetryDataPoint[] {
    if (this.data.length === 0) return [];
    
    const start = Math.max(0, this.data.length - count);
    return this.data.slice(start);
  }
  
  getAll(): TelemetryDataPoint[] {
    return this.data.slice();
  }
  
  clear(): void {
    this.data = [];
    this.updateStats();
  }
  
  trim(beforeTime: number): void {
    if (this.data.length === 0) return;
    
    const keepIndex = binarySearch(this.data, beforeTime);
    if (keepIndex > 0) {
      this.data = this.data.slice(keepIndex);
      this.updateStats();
    }
  }
  
  getStatistics(): BufferStatistics {
    return { ...this.stats };
  }
  
  /**
   * Get interpolated value at specific timestamp
   */
  getInterpolatedValue(timestamp: number): number | null {
    if (this.data.length === 0) return null;
    
    const index = binarySearch(this.data, timestamp);
    
    // Exact match
    if (index < this.data.length && this.data[index].timestamp === timestamp) {
      return typeof this.data[index].value === 'number' ? this.data[index].value : null;
    }
    
    // Before first point
    if (index === 0) {
      return typeof this.data[0].value === 'number' ? this.data[0].value : null;
    }
    
    // After last point
    if (index >= this.data.length) {
      const lastValue = this.data[this.data.length - 1].value;
      return typeof lastValue === 'number' ? lastValue : null;
    }
    
    // Interpolate based on configuration
    const p1 = this.data[index - 1];
    const p2 = this.data[index];
    
    if (typeof p1.value !== 'number' || typeof p2.value !== 'number') {
      return null;
    }
    
    switch (this.config.interpolation) {
      case 'step':
        return p1.value;
        
      case 'linear':
      default:
        const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
        return p1.value + t * (p2.value - p1.value);
        
      case 'smooth':
        // Cubic interpolation if we have enough points
        if (index > 1 && index < this.data.length - 1) {
          const p0 = this.data[index - 2];
          const p3 = this.data[index + 1];
          
          if (typeof p0.value === 'number' && typeof p3.value === 'number') {
            const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
            const t2 = t * t;
            const t3 = t2 * t;
            
            // Catmull-Rom spline
            return 0.5 * (
              (2 * p1.value) +
              (-p0.value + p2.value) * t +
              (2 * p0.value - 5 * p1.value + 4 * p2.value - p3.value) * t2 +
              (-p0.value + 3 * p1.value - 3 * p2.value + p3.value) * t3
            );
          }
        }
        // Fall back to linear
        const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
        return p1.value + t * (p2.value - p1.value);
    }
  }
  
  /**
   * Get aggregated values for time buckets
   */
  getAggregatedBuckets(bucketSize: number, startTime?: number, endTime?: number): Array<{
    timestamp: number;
    value: number;
    count: number;
  }> {
    if (this.data.length === 0) return [];
    
    const start = startTime || this.data[0].timestamp;
    const end = endTime || this.data[this.data.length - 1].timestamp;
    const buckets: Map<number, { sum: number; count: number; values: number[] }> = new Map();
    
    for (const point of this.data) {
      if (point.timestamp < start || point.timestamp > end) continue;
      if (typeof point.value !== 'number') continue;
      
      const bucketIndex = Math.floor((point.timestamp - start) / bucketSize);
      const bucketTime = start + bucketIndex * bucketSize;
      
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, { sum: 0, count: 0, values: [] });
      }
      
      const bucket = buckets.get(bucketTime)!;
      bucket.sum += point.value;
      bucket.count++;
      bucket.values.push(point.value);
    }
    
    const result = Array.from(buckets.entries()).map(([timestamp, bucket]) => {
      let value: number;
      
      switch (this.config.aggregation) {
        case 'min':
          value = Math.min(...bucket.values);
          break;
        case 'max':
          value = Math.max(...bucket.values);
          break;
        case 'last':
          value = bucket.values[bucket.values.length - 1];
          break;
        case 'average':
        default:
          value = bucket.sum / bucket.count;
      }
      
      return { timestamp, value, count: bucket.count };
    });
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  private trimIfNeeded(): void {
    const now = Date.now();
    
    // Time-based trimming
    if (this.config.windowSize > 0) {
      const cutoff = now - this.config.windowSize;
      const keepIndex = binarySearch(this.data, cutoff);
      
      if (keepIndex > 0) {
        this.data = this.data.slice(keepIndex);
      }
    }
    
    // Capacity-based trimming
    if (this.data.length > this.config.capacity) {
      const removeCount = this.data.length - this.config.capacity;
      this.data = this.data.slice(removeCount);
    }
    
    this.lastTrimTime = now;
  }
  
  private compressIfNeeded(): void {
    if (!this.compressor || this.data.length < this.config.compressionThreshold!) {
      return;
    }
    
    this.data = this.compressor.compress(this.data);
    this.stats.compressionRatio = this.compressor.getCompressionRatio();
  }
  
  private updateStats(): void {
    this.stats.count = this.data.length;
    
    if (this.data.length === 0) {
      this.stats.oldestTimestamp = 0;
      this.stats.newestTimestamp = 0;
      this.stats.averageInterval = 0;
      this.stats.utilization = 0;
      return;
    }
    
    this.stats.oldestTimestamp = this.data[0].timestamp;
    this.stats.newestTimestamp = this.data[this.data.length - 1].timestamp;
    this.stats.utilization = this.data.length / this.config.capacity;
    
    // Calculate average interval
    if (this.data.length > 1) {
      const totalTime = this.stats.newestTimestamp - this.stats.oldestTimestamp;
      this.stats.averageInterval = totalTime / (this.data.length - 1);
    } else {
      this.stats.averageInterval = 0;
    }
  }
}