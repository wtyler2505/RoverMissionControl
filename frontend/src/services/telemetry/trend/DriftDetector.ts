/**
 * DriftDetector - Drift detection service for telemetry streams
 * Implements various drift detection algorithms for identifying gradual changes in data distribution
 */

import { TypedEventEmitter as EventEmitter } from '../../websocket/EventEmitter';
import {
  DriftConfig,
  DriftMethod,
  DriftResult
} from './TrendTypes';

/**
 * Drift detector events
 */
export interface DriftDetectorEvents {
  'drift:detected': (result: DriftResult) => void;
  'drift:warning': (result: DriftResult) => void;
  'drift:reset': () => void;
  'stats:update': (stats: DriftStatistics) => void;
}

/**
 * Drift detection statistics
 */
export interface DriftStatistics {
  samplesProcessed: number;
  driftsDetected: number;
  warningsIssued: number;
  lastDrift?: Date;
  currentState: 'stable' | 'warning' | 'drift';
  method: DriftMethod;
}

/**
 * ADWIN (Adaptive Windowing) algorithm for drift detection
 */
class ADWINDetector {
  private window: number[] = [];
  private total = 0;
  private variance = 0;
  private width = 0;
  private delta: number;

  constructor(delta: number = 0.002) {
    this.delta = delta;
  }

  update(value: number): boolean {
    this.insertElement(value);
    return this.detectChange();
  }

  private insertElement(value: number): void {
    this.window.push(value);
    this.width++;
    this.total += value;
    if (this.width > 1) {
      const mean = this.total / this.width;
      this.variance += (value - mean) * (value - mean);
    }
  }

  private detectChange(): boolean {
    if (this.width < 2) return false;

    let changeDetected = false;
    const minWindowSize = 5;
    
    for (let i = minWindowSize; i < this.width - minWindowSize; i++) {
      const n0 = i;
      const n1 = this.width - i;
      const u0 = this.window.slice(0, i).reduce((a, b) => a + b, 0) / n0;
      const u1 = this.window.slice(i).reduce((a, b) => a + b, 0) / n1;
      
      const epsilonCut = Math.sqrt(
        (2 * Math.log(2 / this.delta)) / (2 / (1/n0 + 1/n1))
      );
      
      if (Math.abs(u0 - u1) > epsilonCut) {
        // Remove old data
        this.window = this.window.slice(i);
        this.width = this.window.length;
        this.total = this.window.reduce((a, b) => a + b, 0);
        changeDetected = true;
        break;
      }
    }
    
    return changeDetected;
  }

  getStatistics(): { mean: number; variance: number; windowSize: number } {
    const mean = this.width > 0 ? this.total / this.width : 0;
    return {
      mean,
      variance: this.variance,
      windowSize: this.width
    };
  }

  reset(): void {
    this.window = [];
    this.total = 0;
    this.variance = 0;
    this.width = 0;
  }
}

/**
 * Page-Hinkley test for drift detection
 */
class PageHinkleyDetector {
  private sum = 0;
  private minSum = 0;
  private samples = 0;
  private alpha: number;
  private lambda: number;
  private mean = 0;

  constructor(alpha: number = 0.01, lambda: number = 50) {
    this.alpha = alpha;
    this.lambda = lambda;
  }

  update(value: number): boolean {
    this.samples++;
    
    // Update running mean
    this.mean = (this.mean * (this.samples - 1) + value) / this.samples;
    
    // Update Page-Hinkley statistic
    this.sum += value - this.mean - this.alpha;
    this.minSum = Math.min(this.minSum, this.sum);
    
    // Check for drift
    const PHt = this.sum - this.minSum;
    return PHt > this.lambda;
  }

  getStatistics(): { pht: number; mean: number; samples: number } {
    return {
      pht: this.sum - this.minSum,
      mean: this.mean,
      samples: this.samples
    };
  }

  reset(): void {
    this.sum = 0;
    this.minSum = 0;
    this.samples = 0;
    this.mean = 0;
  }
}

/**
 * DDM (Drift Detection Method)
 */
class DDMDetector {
  private n = 0;
  private p = 0;
  private s = 0;
  private pMin = Infinity;
  private sMin = Infinity;
  private warningLevel: number;
  private driftLevel: number;

  constructor(warningLevel: number = 2, driftLevel: number = 3) {
    this.warningLevel = warningLevel;
    this.driftLevel = driftLevel;
  }

  update(error: number): { drift: boolean; warning: boolean } {
    this.n++;
    
    // Update error rate and standard deviation
    this.p = this.p + (error - this.p) / this.n;
    this.s = Math.sqrt(this.p * (1 - this.p) / this.n);
    
    if (this.n < 30) {
      return { drift: false, warning: false };
    }
    
    // Update minimums
    if (this.p + this.s < this.pMin + this.sMin) {
      this.pMin = this.p;
      this.sMin = this.s;
    }
    
    // Check levels
    const currentLevel = (this.p + this.s - this.pMin - this.sMin) / this.sMin;
    
    return {
      drift: currentLevel > this.driftLevel,
      warning: currentLevel > this.warningLevel
    };
  }

  getStatistics(): { errorRate: number; stdDev: number; samples: number } {
    return {
      errorRate: this.p,
      stdDev: this.s,
      samples: this.n
    };
  }

  reset(): void {
    this.n = 0;
    this.p = 0;
    this.s = 0;
    this.pMin = Infinity;
    this.sMin = Infinity;
  }
}

/**
 * EDDM (Early Drift Detection Method)
 */
class EDDMDetector {
  private n = 0;
  private distances: number[] = [];
  private lastError = -1;
  private mean = 0;
  private stdDev = 0;
  private meanMax = 0;
  private stdDevMax = 0;
  private warningLevel: number;
  private driftLevel: number;

  constructor(warningLevel: number = 0.9, driftLevel: number = 0.95) {
    this.warningLevel = warningLevel;
    this.driftLevel = driftLevel;
  }

  update(error: number): { drift: boolean; warning: boolean } {
    this.n++;
    
    if (error === 1 && this.lastError !== -1) {
      const distance = this.n - this.lastError;
      this.distances.push(distance);
      
      // Update statistics
      this.mean = this.distances.reduce((a, b) => a + b, 0) / this.distances.length;
      const variance = this.distances.reduce((sum, d) => sum + Math.pow(d - this.mean, 2), 0) / this.distances.length;
      this.stdDev = Math.sqrt(variance);
      
      // Update maximums
      if (this.mean + 2 * this.stdDev > this.meanMax + 2 * this.stdDevMax) {
        this.meanMax = this.mean;
        this.stdDevMax = this.stdDev;
      }
    }
    
    if (error === 1) {
      this.lastError = this.n;
    }
    
    if (this.distances.length < 30) {
      return { drift: false, warning: false };
    }
    
    // Calculate ratio
    const current = this.mean + 2 * this.stdDev;
    const max = this.meanMax + 2 * this.stdDevMax;
    const ratio = max > 0 ? current / max : 1;
    
    return {
      drift: ratio < this.driftLevel,
      warning: ratio < this.warningLevel
    };
  }

  getStatistics(): { mean: number; stdDev: number; samples: number } {
    return {
      mean: this.mean,
      stdDev: this.stdDev,
      samples: this.n
    };
  }

  reset(): void {
    this.n = 0;
    this.distances = [];
    this.lastError = -1;
    this.mean = 0;
    this.stdDev = 0;
    this.meanMax = 0;
    this.stdDevMax = 0;
  }
}

/**
 * CUSUM (Cumulative Sum) detector
 */
class CUSUMDetector {
  private sumHigh = 0;
  private sumLow = 0;
  private samples = 0;
  private mean = 0;
  private threshold: number;
  private drift: number;

  constructor(threshold: number = 5, drift: number = 0.5) {
    this.threshold = threshold;
    this.drift = drift;
  }

  update(value: number): boolean {
    this.samples++;
    
    // Update running mean for first 100 samples
    if (this.samples <= 100) {
      this.mean = (this.mean * (this.samples - 1) + value) / this.samples;
      return false;
    }
    
    // Update CUSUM statistics
    this.sumHigh = Math.max(0, this.sumHigh + value - this.mean - this.drift);
    this.sumLow = Math.max(0, this.sumLow - value + this.mean - this.drift);
    
    // Check for drift
    return this.sumHigh > this.threshold || this.sumLow > this.threshold;
  }

  getStatistics(): { sumHigh: number; sumLow: number; mean: number } {
    return {
      sumHigh: this.sumHigh,
      sumLow: this.sumLow,
      mean: this.mean
    };
  }

  reset(): void {
    this.sumHigh = 0;
    this.sumLow = 0;
    this.samples = 0;
    this.mean = 0;
  }
}

/**
 * EWMA (Exponentially Weighted Moving Average) detector
 */
class EWMADetector {
  private ewma = 0;
  private ewmaVar = 0;
  private samples = 0;
  private lambda: number;
  private L: number;
  private initialized = false;

  constructor(lambda: number = 0.2, L: number = 3) {
    this.lambda = lambda;
    this.L = L;
  }

  update(value: number): boolean {
    this.samples++;
    
    if (!this.initialized) {
      this.ewma = value;
      this.ewmaVar = 0;
      this.initialized = true;
      return false;
    }
    
    // Update EWMA
    const prevEWMA = this.ewma;
    this.ewma = this.lambda * value + (1 - this.lambda) * this.ewma;
    
    // Update variance estimate
    const diff = value - prevEWMA;
    this.ewmaVar = this.lambda * diff * diff + (1 - this.lambda) * this.ewmaVar;
    
    if (this.samples < 30) return false;
    
    // Calculate control limits
    const sigma = Math.sqrt(this.ewmaVar);
    const UCL = this.ewma + this.L * sigma * Math.sqrt(this.lambda / (2 - this.lambda));
    const LCL = this.ewma - this.L * sigma * Math.sqrt(this.lambda / (2 - this.lambda));
    
    // Check if current value is outside control limits
    return value > UCL || value < LCL;
  }

  getStatistics(): { ewma: number; variance: number; samples: number } {
    return {
      ewma: this.ewma,
      variance: this.ewmaVar,
      samples: this.samples
    };
  }

  reset(): void {
    this.ewma = 0;
    this.ewmaVar = 0;
    this.samples = 0;
    this.initialized = false;
  }
}

/**
 * Main DriftDetector class
 */
export class DriftDetector extends EventEmitter<DriftDetectorEvents> {
  private config: DriftConfig;
  private detector: ADWINDetector | PageHinkleyDetector | DDMDetector | EDDMDetector | CUSUMDetector | EWMADetector;
  private statistics: DriftStatistics;
  private referenceData: number[] = [];
  private currentData: number[] = [];
  private windowSize: number;

  constructor(config: DriftConfig) {
    super();
    this.config = config;
    this.windowSize = config.windowSize || 100;
    
    // Initialize detector based on method
    this.detector = this.createDetector(config);
    
    // Initialize statistics
    this.statistics = {
      samplesProcessed: 0,
      driftsDetected: 0,
      warningsIssued: 0,
      currentState: 'stable',
      method: config.method
    };
  }

  /**
   * Process a new data point
   */
  processDataPoint(value: number, timestamp: number): DriftResult {
    this.statistics.samplesProcessed++;
    
    // Update data windows
    this.currentData.push(value);
    if (this.currentData.length > this.windowSize) {
      this.referenceData.push(this.currentData.shift()!);
      if (this.referenceData.length > this.windowSize) {
        this.referenceData.shift();
      }
    }
    
    // Detect drift based on method
    const result = this.detectDrift(value);
    
    // Update statistics
    if (result.detected) {
      this.statistics.driftsDetected++;
      this.statistics.lastDrift = new Date(timestamp);
      this.statistics.currentState = 'drift';
      this.emit('drift:detected', result);
    } else if (result.warning) {
      this.statistics.warningsIssued++;
      this.statistics.currentState = 'warning';
      this.emit('drift:warning', result);
    } else {
      this.statistics.currentState = 'stable';
    }
    
    this.emit('stats:update', { ...this.statistics });
    
    return result;
  }

  /**
   * Detect drift using configured method
   */
  private detectDrift(value: number): DriftResult {
    let detected = false;
    let warning = false;
    let testStatistic = 0;
    let threshold = 0;
    
    switch (this.config.method) {
      case DriftMethod.ADWIN:
        detected = (this.detector as ADWINDetector).update(value);
        const adwinStats = (this.detector as ADWINDetector).getStatistics();
        testStatistic = adwinStats.windowSize;
        break;
        
      case DriftMethod.PAGE_HINKLEY:
        detected = (this.detector as PageHinkleyDetector).update(value);
        const phStats = (this.detector as PageHinkleyDetector).getStatistics();
        testStatistic = phStats.pht;
        threshold = 50; // Default lambda
        break;
        
      case DriftMethod.DDM:
        const ddmResult = (this.detector as DDMDetector).update(value > 0.5 ? 1 : 0);
        detected = ddmResult.drift;
        warning = ddmResult.warning;
        break;
        
      case DriftMethod.EDDM:
        const eddmResult = (this.detector as EDDMDetector).update(value > 0.5 ? 1 : 0);
        detected = eddmResult.drift;
        warning = eddmResult.warning;
        break;
        
      case DriftMethod.CUSUM:
        detected = (this.detector as CUSUMDetector).update(value);
        const cusumStats = (this.detector as CUSUMDetector).getStatistics();
        testStatistic = Math.max(cusumStats.sumHigh, cusumStats.sumLow);
        threshold = 5; // Default threshold
        break;
        
      case DriftMethod.EWMA:
        detected = (this.detector as EWMADetector).update(value);
        const ewmaStats = (this.detector as EWMADetector).getStatistics();
        testStatistic = Math.abs(value - ewmaStats.ewma);
        break;
    }
    
    // Calculate means and variances
    const currentMean = this.calculateMean(this.currentData);
    const referenceMean = this.calculateMean(this.referenceData);
    const currentVariance = this.calculateVariance(this.currentData, currentMean);
    const referenceVariance = this.calculateVariance(this.referenceData, referenceMean);
    
    // Calculate confidence
    const confidence = detected ? 0.95 : (warning ? 0.7 : 0.3);
    
    return {
      detected,
      warning,
      confidence,
      driftPoint: detected ? this.statistics.samplesProcessed : undefined,
      driftTimestamp: detected ? Date.now() : undefined,
      currentMean,
      referenceMean,
      currentVariance,
      referenceVariance,
      statistics: {
        testStatistic,
        threshold,
        pValue: this.calculatePValue(testStatistic, threshold)
      }
    };
  }

  /**
   * Reset the detector
   */
  reset(): void {
    this.detector.reset();
    this.referenceData = [];
    this.currentData = [];
    this.statistics = {
      samplesProcessed: 0,
      driftsDetected: 0,
      warningsIssued: 0,
      currentState: 'stable',
      method: this.config.method
    };
    this.emit('drift:reset');
  }

  /**
   * Get current drift statistics
   */
  getDriftStatistics(): DriftStatistics {
    return { ...this.statistics };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DriftConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.method && config.method !== this.statistics.method) {
      this.detector = this.createDetector(this.config);
      this.reset();
    }
  }

  /**
   * Create detector instance based on method
   */
  private createDetector(config: DriftConfig): any {
    switch (config.method) {
      case DriftMethod.ADWIN:
        return new ADWINDetector(1 - config.sensitivity);
        
      case DriftMethod.PAGE_HINKLEY:
        return new PageHinkleyDetector(
          0.01 * config.sensitivity,
          config.driftThreshold || 50
        );
        
      case DriftMethod.DDM:
        return new DDMDetector(
          config.warningThreshold || 2,
          config.driftThreshold || 3
        );
        
      case DriftMethod.EDDM:
        return new EDDMDetector(
          config.warningThreshold || 0.9,
          config.driftThreshold || 0.95
        );
        
      case DriftMethod.CUSUM:
        return new CUSUMDetector(
          config.driftThreshold || 5,
          0.5 * config.sensitivity
        );
        
      case DriftMethod.EWMA:
        return new EWMADetector(
          0.2 * config.sensitivity,
          3
        );
        
      default:
        throw new Error(`Unknown drift detection method: ${config.method}`);
    }
  }

  /**
   * Calculate mean of data
   */
  private calculateMean(data: number[]): number {
    if (data.length === 0) return 0;
    return data.reduce((sum, v) => sum + v, 0) / data.length;
  }

  /**
   * Calculate variance of data
   */
  private calculateVariance(data: number[], mean: number): number {
    if (data.length < 2) return 0;
    const sumSquares = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    return sumSquares / (data.length - 1);
  }

  /**
   * Calculate approximate p-value
   */
  private calculatePValue(testStatistic: number, threshold: number): number {
    if (threshold === 0) return 0.5;
    const z = testStatistic / threshold;
    // Approximate normal CDF
    return 1 - 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  }
}