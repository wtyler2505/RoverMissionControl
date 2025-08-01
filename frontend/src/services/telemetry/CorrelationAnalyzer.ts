/**
 * CorrelationAnalyzer - Advanced Correlation Analysis for Telemetry Streams
 * Provides comprehensive correlation analysis including Pearson, Spearman, and cross-correlation
 */

import { EventEmitter } from '../websocket/EventEmitter';
import { StatisticalAnalysis } from './TelemetryAnalyzer';

/**
 * Correlation result with coefficient and significance
 */
export interface CorrelationResult {
  coefficient: number;
  pValue?: number;
  significance: 'weak' | 'moderate' | 'strong';
  method: 'pearson' | 'spearman' | 'cross';
  sampleSize: number;
}

/**
 * Cross-correlation result with lag analysis
 */
export interface CrossCorrelationResult {
  coefficients: number[];
  lags: number[];
  maxCorrelation: number;
  maxLag: number;
  significantLags: Array<{
    lag: number;
    coefficient: number;
    significance: number;
  }>;
}

/**
 * Lag analysis configuration
 */
export interface LagAnalysisConfig {
  maxLag: number;
  significanceThreshold: number;
  windowSize?: number;
  step?: number;
}

/**
 * Correlation matrix entry
 */
export interface CorrelationMatrixEntry {
  streamId1: string;
  streamId2: string;
  streamName1: string;
  streamName2: string;
  pearson: CorrelationResult;
  spearman: CorrelationResult;
  crossCorrelation: CrossCorrelationResult;
  lastUpdated: Date;
}

/**
 * Stream data interface for correlation analysis
 */
export interface CorrelationStreamData {
  id: string;
  name: string;
  data: number[];
  timestamps: Date[];
  sampleRate: number;
  unit?: string;
}

/**
 * Correlation analysis events
 */
export interface CorrelationAnalyzerEvents {
  'correlation-computed': (result: CorrelationMatrixEntry) => void;
  'matrix-updated': (matrix: Map<string, CorrelationMatrixEntry>) => void;
  'lag-analysis-complete': (streamId1: string, streamId2: string, result: CrossCorrelationResult) => void;
  'batch-analysis-complete': (results: Map<string, CorrelationMatrixEntry>) => void;
  'error': (error: Error) => void;
}

/**
 * Advanced correlation analysis class
 */
export class CorrelationAnalyzer extends EventEmitter<CorrelationAnalyzerEvents> {
  private streams: Map<string, CorrelationStreamData> = new Map();
  private correlationMatrix: Map<string, CorrelationMatrixEntry> = new Map();
  private lagAnalysisConfig: LagAnalysisConfig = {
    maxLag: 100,
    significanceThreshold: 0.3,
    windowSize: 1000,
    step: 1
  };

  constructor(config?: Partial<LagAnalysisConfig>) {
    super();
    if (config) {
      this.lagAnalysisConfig = { ...this.lagAnalysisConfig, ...config };
    }
  }

  /**
   * Add stream data for correlation analysis
   */
  addStream(streamData: CorrelationStreamData): void {
    this.streams.set(streamData.id, { ...streamData });
  }

  /**
   * Remove stream from analysis
   */
  removeStream(streamId: string): void {
    this.streams.delete(streamId);
    
    // Remove all correlation entries involving this stream
    const keysToDelete: string[] = [];
    this.correlationMatrix.forEach((_, key) => {
      if (key.includes(streamId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.correlationMatrix.delete(key));
  }

  /**
   * Update stream data
   */
  updateStreamData(streamId: string, data: number[], timestamps?: Date[]): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.data = data;
    if (timestamps) stream.timestamps = timestamps;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  calculatePearsonCorrelation(x: number[], y: number[]): CorrelationResult {
    if (x.length !== y.length || x.length < 2) {
      throw new Error('Arrays must have same length and at least 2 elements');
    }

    const coefficient = StatisticalAnalysis.correlation(x, y);
    
    // Calculate significance
    let significance: 'weak' | 'moderate' | 'strong' = 'weak';
    const absCoeff = Math.abs(coefficient);
    if (absCoeff >= 0.7) significance = 'strong';
    else if (absCoeff >= 0.4) significance = 'moderate';

    // Calculate p-value (simplified approximation)
    const n = x.length;
    const t = coefficient * Math.sqrt((n - 2) / (1 - coefficient * coefficient));
    const pValue = this.approximatePValue(t, n - 2);

    return {
      coefficient,
      pValue,
      significance,
      method: 'pearson',
      sampleSize: n
    };
  }

  /**
   * Calculate Spearman rank correlation coefficient
   */
  calculateSpearmanCorrelation(x: number[], y: number[]): CorrelationResult {
    if (x.length !== y.length || x.length < 2) {
      throw new Error('Arrays must have same length and at least 2 elements');
    }

    // Create rank arrays
    const rankX = this.calculateRanks(x);
    const rankY = this.calculateRanks(y);

    // Calculate Pearson correlation on ranks
    const coefficient = StatisticalAnalysis.correlation(rankX, rankY);
    
    // Calculate significance
    let significance: 'weak' | 'moderate' | 'strong' = 'weak';
    const absCoeff = Math.abs(coefficient);
    if (absCoeff >= 0.7) significance = 'strong';
    else if (absCoeff >= 0.4) significance = 'moderate';

    // Calculate p-value for Spearman correlation
    const n = x.length;
    const t = coefficient * Math.sqrt((n - 2) / (1 - coefficient * coefficient));
    const pValue = this.approximatePValue(t, n - 2);

    return {
      coefficient,
      pValue,
      significance,
      method: 'spearman',
      sampleSize: n
    };
  }

  /**
   * Calculate cross-correlation with lag analysis
   */
  calculateCrossCorrelation(
    x: number[],
    y: number[],
    config?: Partial<LagAnalysisConfig>
  ): CrossCorrelationResult {
    const analysisConfig = { ...this.lagAnalysisConfig, ...config };
    const { maxLag, significanceThreshold, step } = analysisConfig;

    const coefficients: number[] = [];
    const lags: number[] = [];
    let maxCorrelation = -Infinity;
    let maxLag = 0;
    const significantLags: Array<{ lag: number; coefficient: number; significance: number }> = [];

    // Normalize the data
    const normalizedX = this.normalizeArray(x);
    const normalizedY = this.normalizeArray(y);

    // Calculate cross-correlation for different lags
    for (let lag = -maxLag; lag <= maxLag; lag += step) {
      try {
        const correlation = this.calculateLaggedCorrelation(normalizedX, normalizedY, lag);
        
        coefficients.push(correlation);
        lags.push(lag);

        // Track maximum correlation
        if (Math.abs(correlation) > Math.abs(maxCorrelation)) {
          maxCorrelation = correlation;
          maxLag = lag;
        }

        // Check if correlation is significant
        if (Math.abs(correlation) > significanceThreshold) {
          significantLags.push({
            lag,
            coefficient: correlation,
            significance: Math.abs(correlation)
          });
        }
      } catch (error) {
        // Skip invalid lag values
        coefficients.push(0);
        lags.push(lag);
      }
    }

    // Sort significant lags by significance
    significantLags.sort((a, b) => b.significance - a.significance);

    return {
      coefficients,
      lags,
      maxCorrelation,
      maxLag,
      significantLags: significantLags.slice(0, 10) // Top 10 significant lags
    };
  }

  /**
   * Calculate correlation between two streams
   */
  correlateStreams(streamId1: string, streamId2: string): CorrelationMatrixEntry | null {
    const stream1 = this.streams.get(streamId1);
    const stream2 = this.streams.get(streamId2);

    if (!stream1 || !stream2) return null;

    try {
      // Align data length
      const minLength = Math.min(stream1.data.length, stream2.data.length);
      if (minLength < 3) return null; // Need at least 3 points for meaningful correlation

      const data1 = stream1.data.slice(-minLength);
      const data2 = stream2.data.slice(-minLength);

      // Calculate Pearson correlation
      const pearson = this.calculatePearsonCorrelation(data1, data2);

      // Calculate Spearman correlation
      const spearman = this.calculateSpearmanCorrelation(data1, data2);

      // Calculate cross-correlation with lag analysis
      const crossCorrelation = this.calculateCrossCorrelation(data1, data2);

      const entry: CorrelationMatrixEntry = {
        streamId1,
        streamId2,
        streamName1: stream1.name,
        streamName2: stream2.name,
        pearson,
        spearman,
        crossCorrelation,
        lastUpdated: new Date()
      };

      // Store in matrix
      const key = this.getMatrixKey(streamId1, streamId2);
      this.correlationMatrix.set(key, entry);

      this.emit('correlation-computed', entry);
      return entry;

    } catch (error) {
      this.emit('error', error as Error);
      return null;
    }
  }

  /**
   * Calculate correlation matrix for all streams
   */
  calculateCorrelationMatrix(): Map<string, CorrelationMatrixEntry> {
    const results = new Map<string, CorrelationMatrixEntry>();
    const streamIds = Array.from(this.streams.keys());

    // Calculate correlations for all unique pairs
    for (let i = 0; i < streamIds.length; i++) {
      for (let j = i + 1; j < streamIds.length; j++) {
        const result = this.correlateStreams(streamIds[i], streamIds[j]);
        if (result) {
          const key = this.getMatrixKey(streamIds[i], streamIds[j]);
          results.set(key, result);
        }
      }
    }

    this.emit('matrix-updated', results);
    this.emit('batch-analysis-complete', results);
    return results;
  }

  /**
   * Get correlation result between two streams
   */
  getCorrelation(streamId1: string, streamId2: string): CorrelationMatrixEntry | null {
    const key = this.getMatrixKey(streamId1, streamId2);
    return this.correlationMatrix.get(key) || null;
  }

  /**
   * Get full correlation matrix
   */
  getCorrelationMatrix(): Map<string, CorrelationMatrixEntry> {
    return new Map(this.correlationMatrix);
  }

  /**
   * Find highly correlated stream pairs
   */
  findHighlyCorrelatedPairs(
    method: 'pearson' | 'spearman' = 'pearson',
    threshold: number = 0.7
  ): CorrelationMatrixEntry[] {
    const results: CorrelationMatrixEntry[] = [];

    this.correlationMatrix.forEach(entry => {
      const coefficient = method === 'pearson' 
        ? entry.pearson.coefficient 
        : entry.spearman.coefficient;
      
      if (Math.abs(coefficient) >= threshold) {
        results.push(entry);
      }
    });

    return results.sort((a, b) => {
      const aCoeff = Math.abs(method === 'pearson' ? a.pearson.coefficient : a.spearman.coefficient);
      const bCoeff = Math.abs(method === 'pearson' ? b.pearson.coefficient : b.spearman.coefficient);
      return bCoeff - aCoeff;
    });
  }

  /**
   * Get streams with significant time lags
   */
  getSignificantLags(threshold: number = 0.5): Array<{
    entry: CorrelationMatrixEntry;
    significantLags: Array<{ lag: number; coefficient: number; significance: number }>;
  }> {
    const results: Array<{
      entry: CorrelationMatrixEntry;
      significantLags: Array<{ lag: number; coefficient: number; significance: number }>;
    }> = [];

    this.correlationMatrix.forEach(entry => {
      const significantLags = entry.crossCorrelation.significantLags.filter(
        lag => Math.abs(lag.coefficient) >= threshold
      );

      if (significantLags.length > 0) {
        results.push({ entry, significantLags });
      }
    });

    return results.sort((a, b) => {
      const aMax = Math.max(...a.significantLags.map(l => Math.abs(l.coefficient)));
      const bMax = Math.max(...b.significantLags.map(l => Math.abs(l.coefficient)));
      return bMax - aMax;
    });
  }

  /**
   * Update lag analysis configuration
   */
  updateLagAnalysisConfig(config: Partial<LagAnalysisConfig>): void {
    this.lagAnalysisConfig = { ...this.lagAnalysisConfig, ...config };
  }

  /**
   * Get lag analysis configuration
   */
  getLagAnalysisConfig(): LagAnalysisConfig {
    return { ...this.lagAnalysisConfig };
  }

  /**
   * Export correlation results
   */
  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        streams: Array.from(this.streams.values()).map(s => ({
          id: s.id,
          name: s.name,
          dataPoints: s.data.length,
          sampleRate: s.sampleRate,
          unit: s.unit
        })),
        correlations: Array.from(this.correlationMatrix.values()),
        config: this.lagAnalysisConfig,
        exportDate: new Date().toISOString()
      }, null, 2);
    }

    // CSV format
    const csvLines = [
      'Stream1,Stream2,PearsonCoeff,PearsonSignif,SpearmanCoeff,SpearmanSignif,MaxCrossCorr,MaxLag,LastUpdated'
    ];

    this.correlationMatrix.forEach(entry => {
      csvLines.push([
        entry.streamName1,
        entry.streamName2,
        entry.pearson.coefficient.toFixed(4),
        entry.pearson.significance,
        entry.spearman.coefficient.toFixed(4),
        entry.spearman.significance,
        entry.crossCorrelation.maxCorrelation.toFixed(4),
        entry.crossCorrelation.maxLag.toString(),
        entry.lastUpdated.toISOString()
      ].join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.streams.clear();
    this.correlationMatrix.clear();
  }

  /**
   * Destroy analyzer and cleanup
   */
  destroy(): void {
    this.clear();
    this.removeAllListeners();
  }

  // Private helper methods

  private getMatrixKey(streamId1: string, streamId2: string): string {
    // Ensure consistent key ordering
    return streamId1 < streamId2 ? `${streamId1}:${streamId2}` : `${streamId2}:${streamId1}`;
  }

  private calculateRanks(data: number[]): number[] {
    const indexed = data.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);

    const ranks = new Array(data.length);
    let currentRank = 1;
    
    for (let i = 0; i < indexed.length; i++) {
      if (i > 0 && indexed[i].value !== indexed[i - 1].value) {
        currentRank = i + 1;
      }
      ranks[indexed[i].index] = currentRank;
    }

    return ranks;
  }

  private normalizeArray(data: number[]): number[] {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const std = Math.sqrt(
      data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (data.length - 1)
    );
    
    return std > 0 ? data.map(val => (val - mean) / std) : data.map(() => 0);
  }

  private calculateLaggedCorrelation(x: number[], y: number[], lag: number): number {
    if (lag === 0) {
      return StatisticalAnalysis.correlation(x, y);
    }

    let xData: number[];
    let yData: number[];

    if (lag > 0) {
      // Positive lag: y leads x
      xData = x.slice(0, -lag);
      yData = y.slice(lag);
    } else {
      // Negative lag: x leads y
      xData = x.slice(-lag);
      yData = y.slice(0, lag);
    }

    if (xData.length < 3 || yData.length < 3) {
      throw new Error('Insufficient data for lagged correlation');
    }

    return StatisticalAnalysis.correlation(xData, yData);
  }

  private approximatePValue(tStatistic: number, degreesOfFreedom: number): number {
    // Simplified p-value approximation for t-distribution
    // This is a rough approximation - in production, you'd use a proper statistical library
    const absT = Math.abs(tStatistic);
    
    if (degreesOfFreedom >= 30) {
      // Use normal approximation for large samples
      return 2 * (1 - this.standardNormalCDF(absT));
    }
    
    // Rough approximation for small samples
    const criticalValues = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447];
    const alphaLevels = [0.05, 0.01, 0.005, 0.001, 0.0005, 0.0001];
    
    for (let i = 0; i < criticalValues.length; i++) {
      if (absT >= criticalValues[i]) {
        return alphaLevels[i];
      }
    }
    
    return 0.1; // Default for very small t-statistics
  }

  private standardNormalCDF(x: number): number {
    // Approximation of the standard normal cumulative distribution function
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of the error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

export default CorrelationAnalyzer;