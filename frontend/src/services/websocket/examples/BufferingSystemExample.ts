/**
 * Advanced Data Buffering System - Usage Examples
 * 
 * This file demonstrates how to use the configurable data buffering system
 * for high-performance telemetry streaming with overflow handling and persistence.
 * 
 * Features demonstrated:
 * - Time-based circular buffers with configurable windows
 * - Multiple overflow strategies (FIFO, downsampling, priority-based)
 * - Automatic buffer optimization
 * - Persistence during disconnections
 * - Real-time statistics and health monitoring
 */

import {
  BufferedTelemetryClient,
  DEFAULT_BUFFERED_TELEMETRY_CONFIG,
  BufferOverflowStrategy,
  FlushTrigger,
  TelemetryDataType,
  Priority
} from '../index';

/**
 * Example 1: Basic Buffered Telemetry Client Setup
 */
export class BasicBufferingExample {
  private client: BufferedTelemetryClient;

  constructor() {
    // Create buffered telemetry client with default configuration
    this.client = new BufferedTelemetryClient({
      ...DEFAULT_BUFFERED_TELEMETRY_CONFIG,
      url: 'ws://localhost:8000/ws',
      buffering: {
        enabled: true,
        defaultWindowMs: 200,              // 200ms time window
        defaultOverflowStrategy: BufferOverflowStrategy.FIFO,
        defaultFlushTriggers: [
          FlushTrigger.TIME_INTERVAL,
          FlushTrigger.BUFFER_FULL
        ],
        enablePersistence: true,
        enableStatistics: true,
        statisticsInterval: 1000,
        autoOptimize: false,
        memoryLimit: 100                   // 100MB limit
      }
    });

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    try {
      // Connect to telemetry server
      await this.client.connect();
      console.log('Connected to telemetry server with buffering enabled');

      // Subscribe to a basic telemetry stream
      const streamId = await this.client.subscribe({
        streamId: 'rover-position',
        name: 'Rover Position',
        dataType: TelemetryDataType.VECTOR,
        bufferSize: 1000,
        sampleRate: 10,
        units: 'meters',
        dimensions: { cols: 3 } // X, Y, Z coordinates
      }, Priority.NORMAL);

      console.log(`Subscribed to stream: ${streamId}`);

      // Demonstrate data retrieval after some time
      setTimeout(() => {
        this.demonstrateDataRetrieval(streamId);
      }, 5000);

    } catch (error) {
      console.error('Failed to start basic buffering example:', error);
    }
  }

  private demonstrateDataRetrieval(streamId: string): void {
    // Get all buffered data
    const allData = this.client.getBufferedData(streamId);
    console.log(`Retrieved ${allData.data.length} data points from buffer`);

    // Get latest 10 data points
    const latestData = this.client.getBufferedData(streamId, { count: 10 });
    console.log(`Latest 10 data points:`, latestData.data);

    // Get data from last 2 seconds
    const recentData = this.client.getBufferedData(streamId, {
      startTime: Date.now() - 2000,
      endTime: Date.now()
    });
    console.log(`Data from last 2 seconds: ${recentData.data.length} points`);

    // Get buffer statistics
    const stats = this.client.getBufferStatistics(streamId);
    console.log('Buffer statistics:', {
      utilization: `${stats?.utilizationPercent.toFixed(1)}%`,
      dataRate: `${stats?.dataRate.toFixed(1)} points/sec`,
      healthScore: stats?.healthScore,
      overflowEvents: stats?.overflowEvents
    });
  }

  private setupEventHandlers(): void {
    this.client.on('telemetry:connected', () => {
      console.log('✅ Telemetry client connected');
    });

    this.client.on('telemetry:data', (streamId, data) => {
      console.log(`📊 Data received for ${streamId}:`, data.value);
    });

    this.client.on('buffer:flushed', (event) => {
      console.log(`🚀 Buffer flushed: ${event.streamId}, ${event.data.length} points, trigger: ${event.trigger}`);
    });

    this.client.on('buffer:overflow', (streamId, strategy, droppedCount) => {
      console.warn(`⚠️ Buffer overflow: ${streamId}, strategy: ${strategy}, dropped: ${droppedCount}`);
    });

    this.client.on('buffer:statistics', (streamId, stats) => {
      if (stats.healthScore < 80) {
        console.warn(`🏥 Buffer health warning for ${streamId}: ${stats.healthScore}%`);
      }
    });
  }

  async stop(): Promise<void> {
    await this.client.destroy();
    console.log('Basic buffering example stopped');
  }
}

/**
 * Example 2: High-Performance Configuration with Multiple Strategies
 */
export class HighPerformanceBufferingExample {
  private client: BufferedTelemetryClient;

  constructor() {
    this.client = new BufferedTelemetryClient({
      ...DEFAULT_BUFFERED_TELEMETRY_CONFIG,
      buffering: {
        enabled: true,
        defaultWindowMs: 50,               // 50ms for high-frequency data
        defaultOverflowStrategy: BufferOverflowStrategy.ADAPTIVE,
        defaultFlushTriggers: [
          FlushTrigger.TIME_INTERVAL,
          FlushTrigger.DATA_COUNT,
          FlushTrigger.QUALITY_THRESHOLD
        ],
        enablePersistence: true,
        enableStatistics: true,
        statisticsInterval: 500,           // More frequent stats
        autoOptimize: true,               // Enable auto-optimization
        memoryLimit: 200                  // Higher memory limit
      }
    });

    this.setupAdvancedEventHandlers();
  }

  async start(): Promise<void> {
    try {
      await this.client.connect();

      // Subscribe to multiple high-frequency streams with different configurations
      await this.subscribeToStreams();

      // Start monitoring and optimization
      this.startPerformanceMonitoring();

    } catch (error) {
      console.error('Failed to start high-performance example:', error);
    }
  }

  private async subscribeToStreams(): Promise<void> {
    // High-frequency sensor data with downsampling
    await this.client.subscribe({
      streamId: 'imu-data',
      name: 'IMU Data',
      dataType: TelemetryDataType.VECTOR,
      bufferSize: 2000,
      sampleRate: 200,                    // 200 Hz
      units: 'g/dps',
      dimensions: { cols: 6 }             // Accel + Gyro
    }, Priority.HIGH, {
      windowSizeMs: 25,                   // 25ms window for high frequency
      overflowStrategy: BufferOverflowStrategy.DOWNSAMPLE,
      downsampleFactor: 4,                // Keep 1 out of 4 samples
      flushTriggers: [FlushTrigger.TIME_INTERVAL],
      flushIntervalMs: 100                // Flush every 100ms
    });

    // Critical system status with priority-based filtering
    await this.client.subscribe({
      streamId: 'system-status',
      name: 'System Status',
      dataType: TelemetryDataType.OBJECT,
      bufferSize: 500,
      sampleRate: 5
    }, Priority.CRITICAL, {
      windowSizeMs: 1000,                 // 1 second window
      overflowStrategy: BufferOverflowStrategy.PRIORITY_BASED,
      qualityThreshold: 0.8,              // Only keep high-quality data
      flushTriggers: [
        FlushTrigger.BUFFER_FULL,
        FlushTrigger.QUALITY_THRESHOLD
      ],
      flushQualityThreshold: 0.9
    });

    // Low-frequency environmental data with large window
    await this.client.subscribe({
      streamId: 'environment',
      name: 'Environmental Data',
      dataType: TelemetryDataType.OBJECT,
      bufferSize: 200,
      sampleRate: 1
    }, Priority.LOW, {
      windowSizeMs: 5000,                 // 5 second window
      overflowStrategy: BufferOverflowStrategy.FIFO,
      flushTriggers: [FlushTrigger.TIME_INTERVAL],
      flushIntervalMs: 10000              // Flush every 10 seconds
    });

    console.log('✅ Subscribed to all high-performance streams');
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const report = this.client.getComprehensiveReport();
      
      console.log('\n📈 Performance Report:');
      console.log(`Overall Health Score: ${report.health.overallScore.toFixed(1)}%`);
      console.log(`Total Memory Usage: ${report.performance.buffering.totalMemoryUsageMB.toFixed(2)} MB`);
      console.log(`Active Streams: ${report.performance.buffering.activeStreams}`);
      console.log(`Total Buffers: ${report.performance.buffering.totalBuffers}`);

      // Check for issues
      if (report.health.issues.length > 0) {
        console.warn('⚠️ Health Issues:', report.health.issues);
      }

      // Show recommendations
      if (report.health.recommendations.length > 0) {
        console.log('💡 Recommendations:', report.health.recommendations);
      }

      // Show optimization recommendations
      const optimizations = this.client.getOptimizationRecommendations();
      if (optimizations.length > 0) {
        console.log('🔧 Buffer Optimizations Available:', optimizations.length);
        optimizations.forEach(opt => {
          console.log(`  - ${opt.streamId}: ${opt.reason} (${opt.impact} impact, ${(opt.confidence * 100).toFixed(0)}% confidence)`);
        });
      }

    }, 10000); // Every 10 seconds
  }

  private setupAdvancedEventHandlers(): void {
    this.client.on('buffer:optimized', (streamId, oldConfig, newConfig) => {
      console.log(`🔧 Buffer optimized for ${streamId}:`);
      console.log(`  Window: ${oldConfig.windowSizeMs}ms → ${newConfig.windowSizeMs}ms`);
      console.log(`  Strategy: ${oldConfig.overflowStrategy} → ${newConfig.overflowStrategy}`);
    });

    this.client.on('buffer:memory:limit', (currentUsage, limit) => {
      console.error(`🚨 Memory limit exceeded: ${currentUsage.toFixed(2)}MB / ${limit}MB`);
      // Could trigger emergency buffer clearing or optimization
      this.client.clearAllBuffers();
    });

    this.client.on('buffer:health:warning', (streamId, score, issues) => {
      console.warn(`🏥 Buffer health warning for ${streamId} (score: ${score}%):`);
      issues.forEach(issue => console.warn(`  - ${issue}`));
    });

    this.client.on('buffer:persistent:saved', (streamId, size) => {
      console.log(`💾 Buffer persisted for ${streamId}: ${size} data points`);
    });

    this.client.on('buffer:persistent:restored', (streamId, size) => {
      console.log(`🔄 Buffer restored for ${streamId}: ${size} data points`);
    });
  }

  async stop(): Promise<void> {
    await this.client.destroy();
    console.log('High-performance buffering example stopped');
  }
}

/**
 * Example 3: Custom Buffer Configuration and Manual Control
 */
export class CustomBufferingExample {
  private client: BufferedTelemetryClient;

  constructor() {
    this.client = new BufferedTelemetryClient({
      ...DEFAULT_BUFFERED_TELEMETRY_CONFIG,
      buffering: {
        enabled: true,
        defaultWindowMs: 100,
        defaultOverflowStrategy: BufferOverflowStrategy.FIFO,
        defaultFlushTriggers: [FlushTrigger.MANUAL], // Manual control only
        enablePersistence: false,
        enableStatistics: true,
        statisticsInterval: 2000,
        autoOptimize: false,
        memoryLimit: 50
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.client.connect();

      // Subscribe with custom buffer configuration
      const streamId = await this.client.subscribe({
        streamId: 'custom-stream',
        name: 'Custom Controlled Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 500,
        sampleRate: 20
      }, Priority.NORMAL, {
        windowSizeMs: 300,                  // 300ms window
        maxDataPoints: 100,                 // Limit data points
        overflowStrategy: BufferOverflowStrategy.ADAPTIVE,
        flushTriggers: [FlushTrigger.MANUAL],
        enableStatistics: true,
        adaptiveThresholds: {
          latencyThreshold: 100,
          memoryThreshold: 10,
          dataRateThreshold: 50
        }
      });

      // Demonstrate manual control
      this.demonstrateManualControl(streamId);

    } catch (error) {
      console.error('Failed to start custom buffering example:', error);
    }
  }

  private demonstrateManualControl(streamId: string): void {
    console.log('\n🎮 Manual Buffer Control Demonstration');

    // Flush buffer every 2 seconds
    const flushInterval = setInterval(async () => {
      console.log('🚀 Manually flushing buffer...');
      const flushEvent = await this.client.flushBuffer(streamId);
      
      if (flushEvent) {
        console.log(`Flushed ${flushEvent.data.length} data points in ${flushEvent.flushDurationMs.toFixed(2)}ms`);
      }
    }, 2000);

    // Update buffer configuration after 10 seconds
    setTimeout(async () => {
      console.log('🔧 Updating buffer configuration...');
      
      await this.client.updateBufferConfig(streamId, {
        windowSizeMs: 500,                  // Increase window size
        overflowStrategy: BufferOverflowStrategy.DOWNSAMPLE,
        downsampleFactor: 2
      });
      
      console.log('✅ Buffer configuration updated');
    }, 10000);

    // Clear buffer after 15 seconds
    setTimeout(() => {
      console.log('🧹 Clearing buffer...');
      this.client.clearBuffer(streamId);
      console.log('✅ Buffer cleared');
    }, 15000);

    // Stop demonstrations after 20 seconds
    setTimeout(() => {
      clearInterval(flushInterval);
      console.log('Manual control demonstration completed');
    }, 20000);
  }

  async stop(): Promise<void> {
    await this.client.destroy();
    console.log('Custom buffering example stopped');
  }
}

/**
 * Example 4: Buffer Performance Analysis and Optimization
 */
export class BufferAnalysisExample {
  private client: BufferedTelemetryClient;
  private analysisInterval?: NodeJS.Timeout;

  constructor() {
    this.client = new BufferedTelemetryClient({
      ...DEFAULT_BUFFERED_TELEMETRY_CONFIG,
      buffering: {
        enabled: true,
        defaultWindowMs: 100,
        defaultOverflowStrategy: BufferOverflowStrategy.ADAPTIVE,
        defaultFlushTriggers: [FlushTrigger.BUFFER_FULL, FlushTrigger.TIME_INTERVAL],
        enablePersistence: true,
        enableStatistics: true,
        statisticsInterval: 1000,
        autoOptimize: true,
        memoryLimit: 75
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.client.connect();

      // Create multiple streams with different characteristics
      await this.createAnalysisStreams();
      
      // Start continuous analysis
      this.startAnalysis();

    } catch (error) {
      console.error('Failed to start buffer analysis example:', error);
    }
  }

  private async createAnalysisStreams(): Promise<void> {
    const streamConfigs = [
      {
        config: {
          streamId: 'high-freq-sensor',
          name: 'High Frequency Sensor',
          dataType: TelemetryDataType.NUMERIC,
          bufferSize: 1000,
          sampleRate: 100
        },
        priority: Priority.HIGH,
        bufferOptions: {
          windowSizeMs: 50,
          overflowStrategy: BufferOverflowStrategy.DOWNSAMPLE,
          downsampleFactor: 3
        }
      },
      {
        config: {
          streamId: 'variable-quality',
          name: 'Variable Quality Stream',
          dataType: TelemetryDataType.VECTOR,
          bufferSize: 500,
          sampleRate: 25
        },
        priority: Priority.NORMAL,
        bufferOptions: {
          windowSizeMs: 150,
          overflowStrategy: BufferOverflowStrategy.PRIORITY_BASED,
          qualityThreshold: 0.7
        }
      },
      {
        config: {
          streamId: 'low-freq-critical',
          name: 'Low Frequency Critical',
          dataType: TelemetryDataType.OBJECT,
          bufferSize: 200,
          sampleRate: 2
        },
        priority: Priority.CRITICAL,
        bufferOptions: {
          windowSizeMs: 1000,
          overflowStrategy: BufferOverflowStrategy.DROP_OLDEST
        }
      }
    ];

    for (const stream of streamConfigs) {
      await this.client.subscribe(
        stream.config as any,
        stream.priority,
        stream.bufferOptions
      );
    }

    console.log('✅ Created analysis streams with different characteristics');
  }

  private startAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.performDetailedAnalysis();
    }, 5000);

    // Also analyze optimization recommendations periodically
    setInterval(() => {
      this.analyzeOptimizations();
    }, 15000);
  }

  private performDetailedAnalysis(): void {
    console.log('\n📊 Detailed Buffer Analysis:');
    console.log('=' .repeat(50));

    const allStats = this.client.getBufferStatistics() as Map<string, any>;
    
    for (const [streamId, stats] of allStats) {
      console.log(`\n🔍 Stream: ${streamId}`);
      console.log(`  📈 Utilization: ${stats.utilizationPercent.toFixed(1)}%`);
      console.log(`  ⚡ Data Rate: ${stats.dataRate.toFixed(1)} points/sec`);
      console.log(`  💾 Memory: ${(stats.memoryUsageBytes / 1024).toFixed(1)} KB`);
      console.log(`  🏥 Health: ${stats.healthScore}/100`);
      console.log(`  ⚠️  Overflows: ${stats.overflowEvents}`);
      console.log(`  📊 Quality: ${(stats.averageDataQuality * 100).toFixed(1)}%`);
      console.log(`  ⏱️  Insert Time: ${stats.averageInsertionTime.toFixed(2)}μs`);
      console.log(`  🔄 Flush Rate: ${stats.flushRate.toFixed(2)}/sec`);

      // Performance insights
      const insights = this.generatePerformanceInsights(stats);
      if (insights.length > 0) {
        console.log(`  💡 Insights:`);
        insights.forEach(insight => console.log(`     - ${insight}`));
      }
    }

    // Global analysis
    const globalStats = this.client.metrics.buffering;
    console.log(`\n🌐 Global Buffer Performance:`);
    console.log(`  Total Memory: ${globalStats.totalMemoryUsageMB.toFixed(2)} MB`);
    console.log(`  Avg Utilization: ${globalStats.averageBufferUtilization.toFixed(1)}%`);
    console.log(`  Total Overflows: ${globalStats.totalOverflowEvents}`);
    console.log(`  Total Flushes: ${globalStats.totalFlushEvents}`);
  }

  private generatePerformanceInsights(stats: any): string[] {
    const insights: string[] = [];

    if (stats.utilizationPercent > 90) {
      insights.push('High utilization - consider increasing buffer size');
    }

    if (stats.overflowEvents > 10) {
      insights.push('Frequent overflows - review overflow strategy');
    }

    if (stats.averageInsertionTime > 100) {
      insights.push('Slow insertion - potential performance bottleneck');
    }

    if (stats.averageDataQuality < 0.7) {
      insights.push('Low data quality - check data source');
    }

    if (stats.healthScore < 80) {
      insights.push('Poor health score - immediate attention needed');
    }

    if (stats.flushRate > 5) {
      insights.push('High flush rate - consider adjusting triggers');
    }

    return insights;
  }

  private analyzeOptimizations(): void {
    const recommendations = this.client.getOptimizationRecommendations();
    
    if (recommendations.length === 0) {
      console.log('\n✅ No optimization recommendations - buffers performing optimally');
      return;
    }

    console.log('\n🔧 Optimization Analysis:');
    console.log('=' .repeat(50));

    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. Stream: ${rec.streamId}`);
      console.log(`   Reason: ${rec.reason}`);
      console.log(`   Impact: ${rec.impact.toUpperCase()}`);
      console.log(`   Confidence: ${(rec.confidence * 100).toFixed(0)}%`);
      
      const changes = this.summarizeConfigChanges(rec.currentConfig, rec.recommendedConfig);
      if (changes.length > 0) {
        console.log(`   Changes:`);
        changes.forEach(change => console.log(`     - ${change}`));
      }
    });

    // Apply high-confidence recommendations
    const highConfidenceRecs = recommendations.filter(rec => 
      rec.confidence > 0.8 && rec.impact !== 'low'
    );

    if (highConfidenceRecs.length > 0) {
      console.log(`\n🚀 Auto-applying ${highConfidenceRecs.length} high-confidence optimizations...`);
      this.client.applyOptimizations(highConfidenceRecs);
    }
  }

  private summarizeConfigChanges(current: any, recommended: any): string[] {
    const changes: string[] = [];
    
    const keys = new Set([...Object.keys(current), ...Object.keys(recommended)]);
    
    for (const key of keys) {
      if (current[key] !== recommended[key] && recommended[key] !== undefined) {
        changes.push(`${key}: ${current[key]} → ${recommended[key]}`);
      }
    }
    
    return changes;
  }

  async stop(): Promise<void> {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    await this.client.destroy();
    console.log('Buffer analysis example stopped');
  }
}

/**
 * Usage Examples Runner
 */
export class BufferingExamplesRunner {
  private examples: {
    basic: BasicBufferingExample;
    highPerformance: HighPerformanceBufferingExample;
    custom: CustomBufferingExample;
    analysis: BufferAnalysisExample;
  };

  constructor() {
    this.examples = {
      basic: new BasicBufferingExample(),
      highPerformance: new HighPerformanceBufferingExample(),
      custom: new CustomBufferingExample(),
      analysis: new BufferAnalysisExample()
    };
  }

  async runExample(name: keyof typeof this.examples): Promise<void> {
    console.log(`\n🚀 Running ${name} buffering example...`);
    console.log('=' .repeat(60));

    try {
      await this.examples[name].start();
      
      // Run for 30 seconds then stop  
      setTimeout(async () => {
        await this.examples[name].stop();
        console.log(`\n✅ ${name} example completed`);
      }, 30000);

    } catch (error) {
      console.error(`❌ ${name} example failed:`, error);
    }
  }

  async runAllExamples(): Promise<void> {
    console.log('\n🌟 Running all buffering system examples...\n');
    
    for (const [name, example] of Object.entries(this.examples)) {
      await this.runExample(name as keyof typeof this.examples);
      
      // Wait between examples
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎉 All buffering examples completed!');
  }
}

// Example usage:
// const runner = new BufferingExamplesRunner();
// runner.runExample('basic');
// runner.runAllExamples();