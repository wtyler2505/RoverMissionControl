/**
 * PlaybackController - Time-based navigation and playback control for historical telemetry
 * Supports variable speeds, frame-accurate seeking, and data interpolation
 */

import { TypedEventEmitter as EventEmitter } from '../websocket/EventEmitter';
import { TelemetryDataPoint } from '../websocket/TelemetryManager';
import { HistoricalDataManager, HistoricalDataResponse } from './HistoricalDataManager';

/**
 * Playback state
 */
export enum PlaybackState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  BUFFERING = 'buffering',
  SEEKING = 'seeking'
}

/**
 * Playback speed presets
 */
export const PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

/**
 * Interpolation methods for smooth playback
 */
export enum InterpolationMethod {
  NONE = 'none',              // No interpolation, jump between values
  LINEAR = 'linear',          // Linear interpolation
  CUBIC = 'cubic',           // Cubic spline interpolation
  STEP = 'step',             // Step function (hold previous value)
  SMOOTH = 'smooth'          // Smoothstep interpolation
}

/**
 * Playback configuration
 */
export interface PlaybackConfig {
  startTime: number;
  endTime: number;
  speed: PlaybackSpeed;
  loop: boolean;
  interpolation: InterpolationMethod;
  bufferSize: number;         // Seconds to buffer ahead
  seekPrecision: number;      // Milliseconds precision for seeking
}

/**
 * Playback position information
 */
export interface PlaybackPosition {
  currentTime: number;
  elapsedTime: number;
  remainingTime: number;
  progress: number;           // 0-1 percentage
  frame: number;             // Current frame index
  totalFrames: number;
}

/**
 * Stream playback data
 */
interface StreamPlaybackData {
  streamId: string;
  data: TelemetryDataPoint[];
  currentIndex: number;
  lastEmittedTime: number;
  interpolator?: DataInterpolator;
}

/**
 * Playback controller events
 */
export interface PlaybackControllerEvents {
  'state:changed': (state: PlaybackState) => void;
  'position:update': (position: PlaybackPosition) => void;
  'speed:changed': (speed: PlaybackSpeed) => void;
  'data:update': (streamId: string, data: TelemetryDataPoint) => void;
  'buffer:low': (percentage: number) => void;
  'buffer:ready': () => void;
  'seek:start': (targetTime: number) => void;
  'seek:complete': (actualTime: number) => void;
  'loop:triggered': () => void;
  'error': (error: Error) => void;
}

/**
 * Data interpolator for smooth playback
 */
class DataInterpolator {
  constructor(private method: InterpolationMethod) {}

  interpolate(
    before: TelemetryDataPoint,
    after: TelemetryDataPoint,
    targetTime: number
  ): any {
    if (this.method === InterpolationMethod.NONE) {
      return before.value;
    }

    if (this.method === InterpolationMethod.STEP) {
      return before.value;
    }

    // Calculate interpolation factor
    const t = (targetTime - before.timestamp) / (after.timestamp - before.timestamp);

    switch (this.method) {
      case InterpolationMethod.LINEAR:
        return this.linearInterpolate(before.value, after.value, t);
      
      case InterpolationMethod.CUBIC:
        // Simplified cubic interpolation (would need more points for true cubic)
        return this.cubicInterpolate(before.value, after.value, t);
      
      case InterpolationMethod.SMOOTH:
        return this.smoothstepInterpolate(before.value, after.value, t);
      
      default:
        return before.value;
    }
  }

  private linearInterpolate(a: any, b: any, t: number): any {
    if (typeof a === 'number' && typeof b === 'number') {
      return a + (b - a) * t;
    }
    
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.map((val, i) => 
        typeof val === 'number' && typeof b[i] === 'number'
          ? val + (b[i] - val) * t
          : val
      );
    }
    
    return t < 0.5 ? a : b;
  }

  private cubicInterpolate(a: any, b: any, t: number): any {
    // Simplified cubic using smoothstep
    const t2 = t * t;
    const t3 = t2 * t;
    const factor = 3 * t2 - 2 * t3;
    
    if (typeof a === 'number' && typeof b === 'number') {
      return a + (b - a) * factor;
    }
    
    return this.linearInterpolate(a, b, factor);
  }

  private smoothstepInterpolate(a: any, b: any, t: number): any {
    const smoothT = t * t * (3 - 2 * t);
    return this.linearInterpolate(a, b, smoothT);
  }
}

/**
 * PlaybackController - Main playback control class
 */
export class PlaybackController extends EventEmitter<PlaybackControllerEvents> {
  private state: PlaybackState = PlaybackState.STOPPED;
  private config: PlaybackConfig;
  private historicalDataManager: HistoricalDataManager;
  private streams = new Map<string, StreamPlaybackData>();
  private playbackTimer?: NodeJS.Timeout;
  private currentTime: number = 0;
  private lastUpdateTime: number = 0;
  private bufferCheckInterval?: NodeJS.Timeout;

  constructor(
    historicalDataManager: HistoricalDataManager,
    config: Partial<PlaybackConfig> = {}
  ) {
    super();
    this.historicalDataManager = historicalDataManager;
    this.config = {
      startTime: Date.now() - 3600000, // 1 hour ago
      endTime: Date.now(),
      speed: 1,
      loop: false,
      interpolation: InterpolationMethod.LINEAR,
      bufferSize: 30,
      seekPrecision: 10,
      ...config
    };
    this.currentTime = this.config.startTime;
  }

  /**
   * Add a stream to playback
   */
  async addStream(streamId: string, interpolation?: InterpolationMethod): Promise<void> {
    if (this.streams.has(streamId)) {
      return;
    }

    // Load initial data
    const response = await this.historicalDataManager.queryData({
      streamId,
      startTime: this.config.startTime,
      endTime: Math.min(
        this.config.endTime,
        this.config.startTime + this.config.bufferSize * 1000
      )
    });

    const streamData: StreamPlaybackData = {
      streamId,
      data: response.data,
      currentIndex: 0,
      lastEmittedTime: this.config.startTime,
      interpolator: new DataInterpolator(interpolation || this.config.interpolation)
    };

    this.streams.set(streamId, streamData);
    
    // Start buffer monitoring if not already running
    if (!this.bufferCheckInterval) {
      this.startBufferMonitoring();
    }
  }

  /**
   * Remove a stream from playback
   */
  removeStream(streamId: string): void {
    this.streams.delete(streamId);
    
    if (this.streams.size === 0 && this.bufferCheckInterval) {
      clearInterval(this.bufferCheckInterval);
      this.bufferCheckInterval = undefined;
    }
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (this.state === PlaybackState.PLAYING) {
      return;
    }

    if (this.streams.size === 0) {
      throw new Error('No streams added for playback');
    }

    this.setState(PlaybackState.PLAYING);
    this.lastUpdateTime = Date.now();
    this.startPlaybackTimer();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }

    this.setState(PlaybackState.PAUSED);
    this.stopPlaybackTimer();
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    this.setState(PlaybackState.STOPPED);
    this.stopPlaybackTimer();
    this.currentTime = this.config.startTime;
    
    // Reset all stream indices
    for (const stream of this.streams.values()) {
      stream.currentIndex = 0;
      stream.lastEmittedTime = this.config.startTime;
    }
    
    this.emitPositionUpdate();
  }

  /**
   * Seek to specific time with frame accuracy
   */
  async seek(targetTime: number): Promise<void> {
    // Clamp to valid range
    targetTime = Math.max(this.config.startTime, Math.min(this.config.endTime, targetTime));
    
    // Round to seek precision
    targetTime = Math.round(targetTime / this.config.seekPrecision) * this.config.seekPrecision;
    
    this.emit('seek:start', targetTime);
    
    const wasPlaying = this.state === PlaybackState.PLAYING;
    if (wasPlaying) {
      this.pause();
    }
    
    this.setState(PlaybackState.SEEKING);
    
    try {
      // Update current time
      this.currentTime = targetTime;
      
      // Seek all streams
      await Promise.all(
        Array.from(this.streams.entries()).map(([streamId, stream]) =>
          this.seekStream(streamId, stream, targetTime)
        )
      );
      
      this.emit('seek:complete', this.currentTime);
      this.emitPositionUpdate();
      
      if (wasPlaying) {
        await this.play();
      } else {
        this.setState(PlaybackState.PAUSED);
      }
    } catch (error) {
      this.emit('error', error as Error);
      this.setState(PlaybackState.PAUSED);
    }
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: PlaybackSpeed): void {
    if (!PLAYBACK_SPEEDS.includes(speed)) {
      throw new Error(`Invalid playback speed: ${speed}`);
    }
    
    this.config.speed = speed;
    this.emit('speed:changed', speed);
    
    // Restart timer if playing
    if (this.state === PlaybackState.PLAYING) {
      this.stopPlaybackTimer();
      this.startPlaybackTimer();
    }
  }

  /**
   * Set loop mode
   */
  setLoop(loop: boolean): void {
    this.config.loop = loop;
  }

  /**
   * Get current playback position
   */
  getPosition(): PlaybackPosition {
    const elapsed = this.currentTime - this.config.startTime;
    const total = this.config.endTime - this.config.startTime;
    
    return {
      currentTime: this.currentTime,
      elapsedTime: elapsed,
      remainingTime: total - elapsed,
      progress: elapsed / total,
      frame: this.estimateCurrentFrame(),
      totalFrames: this.estimateTotalFrames()
    };
  }

  /**
   * Get playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<PlaybackConfig> {
    return { ...this.config };
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stop();
    this.streams.clear();
    
    if (this.bufferCheckInterval) {
      clearInterval(this.bufferCheckInterval);
    }
    
    this.removeAllListeners();
  }

  private setState(state: PlaybackState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('state:changed', state);
    }
  }

  private startPlaybackTimer(): void {
    // Calculate update interval based on speed
    const baseInterval = 50; // 20 FPS base rate
    const interval = baseInterval / Math.min(this.config.speed, 4); // Cap interval adjustment
    
    this.playbackTimer = setInterval(() => {
      this.updatePlayback();
    }, interval);
  }

  private stopPlaybackTimer(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }
  }

  private updatePlayback(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) * this.config.speed;
    this.lastUpdateTime = now;
    
    // Update current time
    this.currentTime += deltaTime;
    
    // Check for end of playback
    if (this.currentTime >= this.config.endTime) {
      if (this.config.loop) {
        this.currentTime = this.config.startTime;
        this.emit('loop:triggered');
        
        // Reset all streams
        for (const stream of this.streams.values()) {
          stream.currentIndex = 0;
          stream.lastEmittedTime = this.config.startTime;
        }
      } else {
        this.stop();
        return;
      }
    }
    
    // Update all streams
    for (const [streamId, stream] of this.streams) {
      this.updateStream(streamId, stream);
    }
    
    this.emitPositionUpdate();
  }

  private updateStream(streamId: string, stream: StreamPlaybackData): void {
    const { data, interpolator } = stream;
    
    if (data.length === 0) return;
    
    // Find data points for current time
    while (stream.currentIndex < data.length - 1 &&
           data[stream.currentIndex + 1].timestamp <= this.currentTime) {
      stream.currentIndex++;
    }
    
    // Get current and next data points
    const current = data[stream.currentIndex];
    const next = data[stream.currentIndex + 1];
    
    if (!current) return;
    
    let value: any;
    let emitTime = this.currentTime;
    
    if (interpolator && next && this.currentTime < next.timestamp) {
      // Interpolate between points
      value = interpolator.interpolate(current, next, this.currentTime);
    } else {
      // Use current value
      value = current.value;
      emitTime = current.timestamp;
    }
    
    // Emit at appropriate intervals based on data rate
    const timeSinceLastEmit = emitTime - stream.lastEmittedTime;
    const minEmitInterval = 50 / this.config.speed; // Adjust emit rate based on speed
    
    if (timeSinceLastEmit >= minEmitInterval) {
      const dataPoint: TelemetryDataPoint = {
        timestamp: this.currentTime,
        value,
        quality: current.quality,
        metadata: current.metadata
      };
      
      this.emit('data:update', streamId, dataPoint);
      stream.lastEmittedTime = emitTime;
    }
  }

  private async seekStream(
    streamId: string,
    stream: StreamPlaybackData,
    targetTime: number
  ): Promise<void> {
    // Find the appropriate index for the target time
    const { data } = stream;
    
    if (data.length === 0) return;
    
    // Binary search for efficiency
    let left = 0;
    let right = data.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = data[mid].timestamp;
      
      if (midTime === targetTime) {
        stream.currentIndex = mid;
        break;
      } else if (midTime < targetTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // Set to closest index
    stream.currentIndex = Math.max(0, Math.min(right, data.length - 1));
    stream.lastEmittedTime = targetTime;
    
    // Check if we need to load more data
    const bufferEnd = data[data.length - 1]?.timestamp || 0;
    if (targetTime > bufferEnd - this.config.bufferSize * 1000) {
      await this.loadMoreData(streamId, stream);
    }
  }

  private async loadMoreData(
    streamId: string,
    stream: StreamPlaybackData
  ): Promise<void> {
    const { data } = stream;
    const lastTime = data[data.length - 1]?.timestamp || this.config.startTime;
    
    if (lastTime >= this.config.endTime) {
      return; // No more data to load
    }
    
    try {
      const response = await this.historicalDataManager.queryData({
        streamId,
        startTime: lastTime + 1,
        endTime: Math.min(
          this.config.endTime,
          lastTime + this.config.bufferSize * 1000
        )
      });
      
      // Append new data
      stream.data.push(...response.data);
      
      // Trim old data to prevent memory issues
      const cutoffTime = this.currentTime - this.config.bufferSize * 1000;
      stream.data = stream.data.filter(point => point.timestamp >= cutoffTime);
      
      // Adjust current index after trimming
      const removedCount = data.length - stream.data.length;
      stream.currentIndex = Math.max(0, stream.currentIndex - removedCount);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private startBufferMonitoring(): void {
    this.bufferCheckInterval = setInterval(() => {
      this.checkBufferStatus();
    }, 1000);
  }

  private async checkBufferStatus(): Promise<void> {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }
    
    let minBufferPercentage = 1;
    let needsBuffering = false;
    
    for (const [streamId, stream] of this.streams) {
      const { data } = stream;
      if (data.length === 0) continue;
      
      const lastDataTime = data[data.length - 1].timestamp;
      const bufferRemaining = lastDataTime - this.currentTime;
      const bufferPercentage = bufferRemaining / (this.config.bufferSize * 1000);
      
      minBufferPercentage = Math.min(minBufferPercentage, bufferPercentage);
      
      if (bufferPercentage < 0.3) {
        needsBuffering = true;
        await this.loadMoreData(streamId, stream);
      }
    }
    
    if (minBufferPercentage < 0.2) {
      this.emit('buffer:low', minBufferPercentage);
      
      if (needsBuffering && this.state === PlaybackState.PLAYING) {
        this.setState(PlaybackState.BUFFERING);
        this.pause();
      }
    } else if (this.state === PlaybackState.BUFFERING && minBufferPercentage > 0.5) {
      this.emit('buffer:ready');
      await this.play();
    }
  }

  private emitPositionUpdate(): void {
    this.emit('position:update', this.getPosition());
  }

  private estimateCurrentFrame(): number {
    // Estimate based on average data rate
    let totalPoints = 0;
    let coveredPoints = 0;
    
    for (const stream of this.streams.values()) {
      totalPoints += stream.data.length;
      coveredPoints += stream.currentIndex + 1;
    }
    
    return Math.round(coveredPoints / Math.max(this.streams.size, 1));
  }

  private estimateTotalFrames(): number {
    // Rough estimate based on buffer
    let maxFrames = 0;
    
    for (const stream of this.streams.values()) {
      const { data } = stream;
      if (data.length > 0) {
        const duration = data[data.length - 1].timestamp - data[0].timestamp;
        const rate = data.length / Math.max(duration, 1);
        const totalDuration = this.config.endTime - this.config.startTime;
        const estimatedFrames = Math.round(rate * totalDuration);
        maxFrames = Math.max(maxFrames, estimatedFrames);
      }
    }
    
    return maxFrames;
  }
}