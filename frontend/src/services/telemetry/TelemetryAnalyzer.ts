import { EventEmitter } from '../websocket/EventEmitter';

// FFT implementation for frequency analysis
class FFT {
  private static bitReverse(n: number, bits: number): number {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
      reversed = (reversed << 1) | (n & 1);
      n >>= 1;
    }
    return reversed;
  }

  static compute(real: number[], imag: number[]): { real: number[]; imag: number[] } {
    const n = real.length;
    const bits = Math.log2(n);
    
    if (!Number.isInteger(bits)) {
      throw new Error('FFT requires power of 2 length');
    }

    // Bit-reverse copy
    const realOut = new Array(n);
    const imagOut = new Array(n);
    
    for (let i = 0; i < n; i++) {
      const j = this.bitReverse(i, bits);
      realOut[j] = real[i];
      imagOut[j] = imag[i];
    }

    // FFT computation
    for (let len = 2; len <= n; len <<= 1) {
      const angle = -2 * Math.PI / len;
      const wlen = { real: Math.cos(angle), imag: Math.sin(angle) };
      
      for (let i = 0; i < n; i += len) {
        let w = { real: 1, imag: 0 };
        
        for (let j = 0; j < len / 2; j++) {
          const u = {
            real: realOut[i + j],
            imag: imagOut[i + j]
          };
          
          const v = {
            real: realOut[i + j + len / 2] * w.real - imagOut[i + j + len / 2] * w.imag,
            imag: realOut[i + j + len / 2] * w.imag + imagOut[i + j + len / 2] * w.real
          };
          
          realOut[i + j] = u.real + v.real;
          imagOut[i + j] = u.imag + v.imag;
          realOut[i + j + len / 2] = u.real - v.real;
          imagOut[i + j + len / 2] = u.imag - v.imag;
          
          const wTemp = w.real * wlen.real - w.imag * wlen.imag;
          w.imag = w.real * wlen.imag + w.imag * wlen.real;
          w.real = wTemp;
        }
      }
    }

    return { real: realOut, imag: imagOut };
  }

  static magnitude(real: number[], imag: number[]): number[] {
    return real.map((r, i) => Math.sqrt(r * r + imag[i] * imag[i]));
  }

  static phase(real: number[], imag: number[]): number[] {
    return real.map((r, i) => Math.atan2(imag[i], r));
  }
}

// Statistical analysis utilities
export class StatisticalAnalysis {
  static mean(data: number[]): number {
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  static median(data: number[]): number {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  static mode(data: number[]): number[] {
    const frequency = new Map<number, number>();
    data.forEach(val => frequency.set(val, (frequency.get(val) || 0) + 1));
    
    const maxFreq = Math.max(...frequency.values());
    return Array.from(frequency.entries())
      .filter(([_, freq]) => freq === maxFreq)
      .map(([val, _]) => val);
  }

  static standardDeviation(data: number[]): number {
    const avg = this.mean(data);
    const squareDiffs = data.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  static variance(data: number[]): number {
    return Math.pow(this.standardDeviation(data), 2);
  }

  static percentile(data: number[], p: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sorted[lower];
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  static skewness(data: number[]): number {
    const n = data.length;
    const mean = this.mean(data);
    const std = this.standardDeviation(data);
    
    const skew = data.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / std, 3);
    }, 0);
    
    return (n / ((n - 1) * (n - 2))) * skew;
  }

  static kurtosis(data: number[]): number {
    const n = data.length;
    const mean = this.mean(data);
    const std = this.standardDeviation(data);
    
    const kurt = data.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / std, 4);
    }, 0);
    
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurt - 
           (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length) throw new Error('Arrays must have same length');
    
    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      denomX += deltaX * deltaX;
      denomY += deltaY * deltaY;
    }
    
    return numerator / Math.sqrt(denomX * denomY);
  }

  static linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += (x[i] - meanX) * (x[i] - meanX);
    }
    
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    
    // Calculate R²
    const correlation = this.correlation(x, y);
    const r2 = correlation * correlation;
    
    return { slope, intercept, r2 };
  }
}

// Anomaly detection methods
export class AnomalyDetection {
  static zScore(data: number[], threshold: number = 3): { anomalies: number[]; indices: number[] } {
    const mean = StatisticalAnalysis.mean(data);
    const std = StatisticalAnalysis.standardDeviation(data);
    
    const anomalies: number[] = [];
    const indices: number[] = [];
    
    data.forEach((value, index) => {
      const z = Math.abs((value - mean) / std);
      if (z > threshold) {
        anomalies.push(value);
        indices.push(index);
      }
    });
    
    return { anomalies, indices };
  }

  static iqrOutliers(data: number[], factor: number = 1.5): { anomalies: number[]; indices: number[] } {
    const q1 = StatisticalAnalysis.percentile(data, 25);
    const q3 = StatisticalAnalysis.percentile(data, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - factor * iqr;
    const upperBound = q3 + factor * iqr;
    
    const anomalies: number[] = [];
    const indices: number[] = [];
    
    data.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        anomalies.push(value);
        indices.push(index);
      }
    });
    
    return { anomalies, indices };
  }

  static movingAverage(data: number[], windowSize: number, threshold: number = 2): { anomalies: number[]; indices: number[] } {
    const anomalies: number[] = [];
    const indices: number[] = [];
    
    for (let i = windowSize; i < data.length; i++) {
      const window = data.slice(i - windowSize, i);
      const mean = StatisticalAnalysis.mean(window);
      const std = StatisticalAnalysis.standardDeviation(window);
      
      const deviation = Math.abs(data[i] - mean);
      if (deviation > threshold * std) {
        anomalies.push(data[i]);
        indices.push(i);
      }
    }
    
    return { anomalies, indices };
  }

  static isolationForest(data: number[], contamination: number = 0.1): { anomalies: number[]; indices: number[]; scores: number[] } {
    // Simplified isolation forest implementation
    const n = data.length;
    const numTrees = 100;
    const subsampleSize = Math.min(256, n);
    
    const scores = data.map((_, index) => {
      let totalPathLength = 0;
      
      for (let tree = 0; tree < numTrees; tree++) {
        // Random subsample
        const subsample = [];
        for (let i = 0; i < subsampleSize; i++) {
          subsample.push(data[Math.floor(Math.random() * n)]);
        }
        
        // Build simple tree and calculate path length
        let pathLength = 0;
        let currentValue = data[index];
        let min = Math.min(...subsample);
        let max = Math.max(...subsample);
        
        while (min < max && pathLength < 10) { // Limit depth
          const split = min + Math.random() * (max - min);
          if (currentValue < split) {
            max = split;
          } else {
            min = split;
          }
          pathLength++;
        }
        
        totalPathLength += pathLength;
      }
      
      return totalPathLength / numTrees;
    });
    
    // Normalize scores
    const meanScore = StatisticalAnalysis.mean(scores);
    const normalizedScores = scores.map(score => Math.exp(-score / meanScore));
    
    // Find anomalies based on contamination rate
    const threshold = StatisticalAnalysis.percentile(normalizedScores, (1 - contamination) * 100);
    
    const anomalies: number[] = [];
    const indices: number[] = [];
    
    normalizedScores.forEach((score, index) => {
      if (score > threshold) {
        anomalies.push(data[index]);
        indices.push(index);
      }
    });
    
    return { anomalies, indices, scores: normalizedScores };
  }
}

// Trend detection and prediction
export class TrendAnalysis {
  static detectTrend(data: number[], windowSize: number = 10): 'increasing' | 'decreasing' | 'stable' {
    if (data.length < windowSize) return 'stable';
    
    const recentData = data.slice(-windowSize);
    const indices = Array.from({ length: windowSize }, (_, i) => i);
    
    const { slope } = StatisticalAnalysis.linearRegression(indices, recentData);
    
    if (Math.abs(slope) < 0.01) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  static simpleMovingAverage(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  static exponentialMovingAverage(data: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is the first data point
    ema[0] = data[0];
    
    for (let i = 1; i < data.length; i++) {
      ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  }

  static predict(data: number[], periods: number = 5): number[] {
    if (data.length < 2) return [];
    
    const indices = Array.from({ length: data.length }, (_, i) => i);
    const { slope, intercept } = StatisticalAnalysis.linearRegression(indices, data);
    
    const predictions: number[] = [];
    const lastIndex = data.length - 1;
    
    for (let i = 1; i <= periods; i++) {
      predictions.push(slope * (lastIndex + i) + intercept);
    }
    
    return predictions;
  }

  static seasonalDecomposition(data: number[], period: number): { trend: number[]; seasonal: number[]; residual: number[] } {
    // Simple seasonal decomposition
    const trend = this.simpleMovingAverage(data, period);
    const seasonal: number[] = new Array(data.length);
    const residual: number[] = new Array(data.length);
    
    // Calculate seasonal component
    const seasonalPattern = new Array(period).fill(0);
    let patternCount = new Array(period).fill(0);
    
    for (let i = Math.floor(period / 2); i < data.length - Math.floor(period / 2); i++) {
      const trendIndex = i - Math.floor(period / 2);
      const detrended = data[i] - trend[trendIndex];
      const seasonIndex = i % period;
      
      seasonalPattern[seasonIndex] += detrended;
      patternCount[seasonIndex]++;
    }
    
    // Average seasonal pattern
    for (let i = 0; i < period; i++) {
      if (patternCount[i] > 0) {
        seasonalPattern[i] /= patternCount[i];
      }
    }
    
    // Apply seasonal pattern to all data
    for (let i = 0; i < data.length; i++) {
      seasonal[i] = seasonalPattern[i % period];
      
      if (i >= Math.floor(period / 2) && i < data.length - Math.floor(period / 2)) {
        const trendIndex = i - Math.floor(period / 2);
        residual[i] = data[i] - trend[trendIndex] - seasonal[i];
      } else {
        residual[i] = 0;
      }
    }
    
    return { trend, seasonal, residual };
  }
}

// Frequency analysis
export class FrequencyAnalysis {
  static fft(data: number[], sampleRate: number): { frequencies: number[]; magnitudes: number[]; phases: number[] } {
    // Pad to power of 2
    const n = Math.pow(2, Math.ceil(Math.log2(data.length)));
    const paddedData = [...data, ...new Array(n - data.length).fill(0)];
    const imagData = new Array(n).fill(0);
    
    const result = FFT.compute(paddedData, imagData);
    const magnitudes = FFT.magnitude(result.real, result.imag);
    const phases = FFT.phase(result.real, result.imag);
    
    // Generate frequency bins
    const frequencies = Array.from({ length: n / 2 }, (_, i) => (i * sampleRate) / n);
    
    return {
      frequencies,
      magnitudes: magnitudes.slice(0, n / 2),
      phases: phases.slice(0, n / 2)
    };
  }

  static findPeaks(magnitudes: number[], frequencies: number[], threshold: number = 0.1): { frequency: number; magnitude: number }[] {
    const peaks: { frequency: number; magnitude: number }[] = [];
    const maxMagnitude = Math.max(...magnitudes);
    const minPeakHeight = maxMagnitude * threshold;
    
    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && 
          magnitudes[i] > magnitudes[i + 1] && 
          magnitudes[i] > minPeakHeight) {
        peaks.push({
          frequency: frequencies[i],
          magnitude: magnitudes[i]
        });
      }
    }
    
    return peaks.sort((a, b) => b.magnitude - a.magnitude);
  }

  static powerSpectralDensity(data: number[], sampleRate: number): { frequencies: number[]; psd: number[] } {
    const { frequencies, magnitudes } = this.fft(data, sampleRate);
    const n = data.length;
    
    // Convert to power spectral density
    const psd = magnitudes.map(mag => (mag * mag) / (sampleRate * n));
    
    return { frequencies, psd };
  }

  static spectrogram(data: number[], windowSize: number, hopSize: number, sampleRate: number): {
    timeStamps: number[];
    frequencies: number[];
    magnitudes: number[][];
  } {
    const timeStamps: number[] = [];
    const spectrogramData: number[][] = [];
    
    for (let i = 0; i + windowSize <= data.length; i += hopSize) {
      const window = data.slice(i, i + windowSize);
      const { frequencies, magnitudes } = this.fft(window, sampleRate);
      
      timeStamps.push(i / sampleRate);
      spectrogramData.push(magnitudes);
    }
    
    // Get frequencies from first window
    const { frequencies } = this.fft(data.slice(0, windowSize), sampleRate);
    
    return {
      timeStamps,
      frequencies,
      magnitudes: spectrogramData
    };
  }
}

// Data filtering
export class DataFilter {
  static lowPass(data: number[], cutoffFreq: number, sampleRate: number): number[] {
    const rc = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / sampleRate;
    const alpha = dt / (rc + dt);
    
    const filtered = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * data[i] + (1 - alpha) * filtered[i - 1];
    }
    
    return filtered;
  }

  static highPass(data: number[], cutoffFreq: number, sampleRate: number): number[] {
    const rc = 1 / (2 * Math.PI * cutoffFreq);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    
    const filtered = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + data[i] - data[i - 1]);
    }
    
    return filtered;
  }

  static bandPass(data: number[], lowCutoff: number, highCutoff: number, sampleRate: number): number[] {
    const lowPassed = this.lowPass(data, highCutoff, sampleRate);
    return this.highPass(lowPassed, lowCutoff, sampleRate);
  }

  static notch(data: number[], notchFreq: number, bandwidth: number, sampleRate: number): number[] {
    // Simple notch filter implementation
    const dt = 1 / sampleRate;
    const w = 2 * Math.PI * notchFreq;
    const bw = 2 * Math.PI * bandwidth;
    
    const r = 1 - bw * dt / 2;
    const cosw = Math.cos(w * dt);
    
    const b0 = 1;
    const b1 = -2 * cosw;
    const b2 = 1;
    const a1 = -2 * r * cosw;
    const a2 = r * r;
    
    const filtered = new Array(data.length);
    filtered[0] = data[0];
    filtered[1] = data[1];
    
    for (let i = 2; i < data.length; i++) {
      filtered[i] = b0 * data[i] + b1 * data[i - 1] + b2 * data[i - 2] - 
                   a1 * filtered[i - 1] - a2 * filtered[i - 2];
    }
    
    return filtered;
  }

  static median(data: number[], windowSize: number): number[] {
    const filtered: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(data.length, i + halfWindow + 1);
      const window = data.slice(start, end);
      
      filtered.push(StatisticalAnalysis.median(window));
    }
    
    return filtered;
  }

  static savitzkyGolay(data: number[], windowSize: number, polyOrder: number): number[] {
    // Simplified Savitzky-Golay filter (quadratic smoothing)
    if (polyOrder !== 2) {
      console.warn('Savitzky-Golay filter only supports quadratic smoothing (polyOrder=2)');
    }
    
    const filtered: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let weightSum = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const index = i + j;
        if (index >= 0 && index < data.length) {
          // Simple quadratic weights
          const weight = 1 - (j * j) / (halfWindow * halfWindow);
          sum += data[index] * weight;
          weightSum += weight;
        }
      }
      
      filtered.push(sum / weightSum);
    }
    
    return filtered;
  }
}

// Data export and reporting
export interface AnalysisReport {
  summary: {
    dataPoints: number;
    timeRange: { start: Date; end: Date };
    statistics: {
      mean: number;
      median: number;
      std: number;
      min: number;
      max: number;
    };
  };
  anomalies: {
    count: number;
    percentage: number;
    method: string;
    indices: number[];
    values: number[];
  };
  trends: {
    direction: string;
    strength: number;
    predictions: number[];
  };
  frequency: {
    dominantFrequency: number;
    peaks: { frequency: number; magnitude: number }[];
  };
  correlations?: Array<{
    streamName: string;
    coefficient: number;
    strength: 'weak' | 'moderate' | 'strong';
  }>;
}

export class ReportGenerator {
  static generateReport(
    data: number[],
    streamName: string,
    sampleRate: number,
    timeStamps?: Date[],
    correlationData?: { [streamName: string]: number[] }
  ): AnalysisReport {
    const stats = {
      mean: StatisticalAnalysis.mean(data),
      median: StatisticalAnalysis.median(data),
      std: StatisticalAnalysis.standardDeviation(data),
      min: Math.min(...data),
      max: Math.max(...data)
    };

    const anomalies = AnomalyDetection.zScore(data);
    const trend = TrendAnalysis.detectTrend(data);
    const predictions = TrendAnalysis.predict(data, 5);
    const { frequencies, magnitudes } = FrequencyAnalysis.fft(data, sampleRate);
    const peaks = FrequencyAnalysis.findPeaks(magnitudes, frequencies, 0.1);

    const correlations = correlationData ? 
      Object.entries(correlationData).map(([name, values]) => {
        const coeff = StatisticalAnalysis.correlation(data, values);
        let strength: 'weak' | 'moderate' | 'strong' = 'weak';
        if (Math.abs(coeff) > 0.7) strength = 'strong';
        else if (Math.abs(coeff) > 0.3) strength = 'moderate';
        
        return { streamName: name, coefficient: coeff, strength };
      }) : undefined;

    return {
      summary: {
        dataPoints: data.length,
        timeRange: {
          start: timeStamps?.[0] || new Date(),
          end: timeStamps?.[timeStamps.length - 1] || new Date()
        },
        statistics: stats
      },
      anomalies: {
        count: anomalies.anomalies.length,
        percentage: (anomalies.anomalies.length / data.length) * 100,
        method: 'Z-Score',
        indices: anomalies.indices,
        values: anomalies.anomalies
      },
      trends: {
        direction: trend,
        strength: Math.abs(StatisticalAnalysis.linearRegression(
          Array.from({ length: data.length }, (_, i) => i),
          data
        ).slope),
        predictions
      },
      frequency: {
        dominantFrequency: peaks[0]?.frequency || 0,
        peaks: peaks.slice(0, 5)
      },
      correlations
    };
  }

  static exportToCSV(report: AnalysisReport, data: number[], timeStamps?: Date[]): string {
    const headers = ['Timestamp', 'Value', 'IsAnomaly'];
    const rows = [headers.join(',')];

    data.forEach((value, index) => {
      const timestamp = timeStamps?.[index]?.toISOString() || index.toString();
      const isAnomaly = report.anomalies.indices.includes(index) ? 'true' : 'false';
      rows.push([timestamp, value.toString(), isAnomaly].join(','));
    });

    return rows.join('\n');
  }

  static exportToJSON(report: AnalysisReport, data: number[], timeStamps?: Date[]): string {
    return JSON.stringify({
      report,
      data: data.map((value, index) => ({
        timestamp: timeStamps?.[index]?.toISOString() || index.toString(),
        value,
        isAnomaly: report.anomalies.indices.includes(index)
      }))
    }, null, 2);
  }
}

// Main TelemetryAnalyzer class
export interface TelemetryStream {
  id: string;
  name: string;
  data: number[];
  timestamps: Date[];
  sampleRate: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface AnalysisConfig {
  anomalyDetection: {
    method: 'zscore' | 'iqr' | 'isolation' | 'moving_average';
    threshold?: number;
    windowSize?: number;
    contamination?: number;
  };
  frequencyAnalysis: {
    enabled: boolean;
    windowSize?: number;
    peakThreshold?: number;
  };
  filtering: {
    type?: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'median' | 'savgol';
    cutoffFreq?: number;
    lowCutoff?: number;
    highCutoff?: number;
    windowSize?: number;
    polyOrder?: number;
  };
  correlation: {
    enabled: boolean;
    streams: string[];
  };
  trends: {
    enabled: boolean;
    windowSize?: number;
    predictionPeriods?: number;
  };
}

export class TelemetryAnalyzer extends EventEmitter {
  private streams: Map<string, TelemetryStream> = new Map();
  private analysisResults: Map<string, AnalysisReport> = new Map();
  private config: AnalysisConfig;
  private analysisInterval?: NodeJS.Timeout;

  constructor(config: Partial<AnalysisConfig> = {}) {
    super();
    
    this.config = {
      anomalyDetection: {
        method: 'zscore',
        threshold: 3,
        windowSize: 50,
        contamination: 0.1,
        ...config.anomalyDetection
      },
      frequencyAnalysis: {
        enabled: true,
        windowSize: 1024,
        peakThreshold: 0.1,
        ...config.frequencyAnalysis
      },
      filtering: {
        type: 'lowpass',
        cutoffFreq: 10,
        windowSize: 5,
        polyOrder: 2,
        ...config.filtering
      },
      correlation: {
        enabled: true,
        streams: [],
        ...config.correlation
      },
      trends: {
        enabled: true,
        windowSize: 100,
        predictionPeriods: 5,
        ...config.trends
      }
    };
  }

  addStream(stream: TelemetryStream): void {
    this.streams.set(stream.id, stream);
    this.emit('stream-added', { streamId: stream.id, name: stream.name });
  }

  removeStream(streamId: string): void {
    if (this.streams.delete(streamId)) {
      this.analysisResults.delete(streamId);
      this.emit('stream-removed', { streamId });
    }
  }

  updateStreamData(streamId: string, data: number[], timestamps?: Date[]): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.data = data;
    if (timestamps) stream.timestamps = timestamps;

    this.emit('stream-updated', { streamId, dataLength: data.length });
  }

  appendStreamData(streamId: string, value: number, timestamp?: Date): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.data.push(value);
    stream.timestamps.push(timestamp || new Date());

    // Limit buffer size (keep last 10000 points)
    const maxPoints = 10000;
    if (stream.data.length > maxPoints) {
      stream.data = stream.data.slice(-maxPoints);
      stream.timestamps = stream.timestamps.slice(-maxPoints);
    }

    this.emit('data-appended', { streamId, value, timestamp });
  }

  filterStreamData(streamId: string, filterConfig?: AnalysisConfig['filtering']): number[] {
    const stream = this.streams.get(streamId);
    if (!stream) return [];

    const config = filterConfig || this.config.filtering;
    const { data } = stream;

    switch (config.type) {
      case 'lowpass':
        return DataFilter.lowPass(data, config.cutoffFreq!, stream.sampleRate);
      case 'highpass':
        return DataFilter.highPass(data, config.cutoffFreq!, stream.sampleRate);
      case 'bandpass':
        return DataFilter.bandPass(data, config.lowCutoff!, config.highCutoff!, stream.sampleRate);
      case 'notch':
        return DataFilter.notch(data, config.cutoffFreq!, 1, stream.sampleRate);
      case 'median':
        return DataFilter.median(data, config.windowSize!);
      case 'savgol':
        return DataFilter.savitzkyGolay(data, config.windowSize!, config.polyOrder!);
      default:
        return data;
    }
  }

  analyzeStream(streamId: string): AnalysisReport | null {
    const stream = this.streams.get(streamId);
    if (!stream || stream.data.length === 0) return null;

    // Apply filtering if configured
    const filteredData = this.filterStreamData(streamId);
    
    // Get correlation data if enabled
    const correlationData: { [streamName: string]: number[] } = {};
    if (this.config.correlation.enabled) {
      this.config.correlation.streams.forEach(otherId => {
        const otherStream = this.streams.get(otherId);
        if (otherStream && otherId !== streamId) {
          correlationData[otherStream.name] = otherStream.data;
        }
      });
    }

    const report = ReportGenerator.generateReport(
      filteredData,
      stream.name,
      stream.sampleRate,
      stream.timestamps,
      Object.keys(correlationData).length > 0 ? correlationData : undefined
    );

    this.analysisResults.set(streamId, report);
    this.emit('analysis-complete', { streamId, report });

    return report;
  }

  analyzeAllStreams(): Map<string, AnalysisReport> {
    const results = new Map<string, AnalysisReport>();
    
    this.streams.forEach((_, streamId) => {
      const report = this.analyzeStream(streamId);
      if (report) {
        results.set(streamId, report);
      }
    });

    return results;
  }

  getStreamStatistics(streamId: string): any {
    const stream = this.streams.get(streamId);
    if (!stream || stream.data.length === 0) return null;

    const data = stream.data;
    return {
      count: data.length,
      mean: StatisticalAnalysis.mean(data),
      median: StatisticalAnalysis.median(data),
      std: StatisticalAnalysis.standardDeviation(data),
      min: Math.min(...data),
      max: Math.max(...data),
      skewness: StatisticalAnalysis.skewness(data),
      kurtosis: StatisticalAnalysis.kurtosis(data),
      percentiles: {
        p25: StatisticalAnalysis.percentile(data, 25),
        p50: StatisticalAnalysis.percentile(data, 50),
        p75: StatisticalAnalysis.percentile(data, 75),
        p90: StatisticalAnalysis.percentile(data, 90),
        p95: StatisticalAnalysis.percentile(data, 95),
        p99: StatisticalAnalysis.percentile(data, 99)
      }
    };
  }

  detectAnomalies(streamId: string, method?: AnalysisConfig['anomalyDetection']): { anomalies: number[]; indices: number[] } | null {
    const stream = this.streams.get(streamId);
    if (!stream) return null;

    const config = method || this.config.anomalyDetection;
    const { data } = stream;

    switch (config.method) {
      case 'zscore':
        return AnomalyDetection.zScore(data, config.threshold);
      case 'iqr':
        return AnomalyDetection.iqrOutliers(data, config.threshold || 1.5);
      case 'isolation':
        return AnomalyDetection.isolationForest(data, config.contamination);
      case 'moving_average':
        return AnomalyDetection.movingAverage(data, config.windowSize!, config.threshold);
      default:
        return AnomalyDetection.zScore(data, config.threshold);
    }
  }

  correlateStreams(streamId1: string, streamId2: string): number | null {
    const stream1 = this.streams.get(streamId1);
    const stream2 = this.streams.get(streamId2);
    
    if (!stream1 || !stream2) return null;
    
    const minLength = Math.min(stream1.data.length, stream2.data.length);
    const data1 = stream1.data.slice(0, minLength);
    const data2 = stream2.data.slice(0, minLength);
    
    return StatisticalAnalysis.correlation(data1, data2);
  }

  getFrequencyAnalysis(streamId: string): { frequencies: number[]; magnitudes: number[]; peaks: { frequency: number; magnitude: number }[] } | null {
    const stream = this.streams.get(streamId);
    if (!stream) return null;

    const { frequencies, magnitudes } = FrequencyAnalysis.fft(stream.data, stream.sampleRate);
    const peaks = FrequencyAnalysis.findPeaks(magnitudes, frequencies, this.config.frequencyAnalysis.peakThreshold);

    return { frequencies, magnitudes, peaks };
  }

  exportAnalysisReport(streamId: string, format: 'json' | 'csv' = 'json'): string | null {
    const stream = this.streams.get(streamId);
    const report = this.analysisResults.get(streamId);
    
    if (!stream || !report) return null;

    switch (format) {
      case 'json':
        return ReportGenerator.exportToJSON(report, stream.data, stream.timestamps);
      case 'csv':
        return ReportGenerator.exportToCSV(report, stream.data, stream.timestamps);
      default:
        return null;
    }
  }

  startRealTimeAnalysis(intervalMs: number = 5000): void {
    this.stopRealTimeAnalysis();
    
    this.analysisInterval = setInterval(() => {
      this.analyzeAllStreams();
      this.emit('real-time-analysis-complete');
    }, intervalMs);

    this.emit('real-time-analysis-started', { interval: intervalMs });
  }

  stopRealTimeAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
      this.emit('real-time-analysis-stopped');
    }
  }

  updateConfig(newConfig: Partial<AnalysisConfig>): void {
    this.config = {
      anomalyDetection: { ...this.config.anomalyDetection, ...newConfig.anomalyDetection },
      frequencyAnalysis: { ...this.config.frequencyAnalysis, ...newConfig.frequencyAnalysis },
      filtering: { ...this.config.filtering, ...newConfig.filtering },
      correlation: { ...this.config.correlation, ...newConfig.correlation },
      trends: { ...this.config.trends, ...newConfig.trends }
    };

    this.emit('config-updated', { config: this.config });
  }

  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  getStream(streamId: string): TelemetryStream | undefined {
    return this.streams.get(streamId);
  }

  getAllStreams(): TelemetryStream[] {
    return Array.from(this.streams.values());
  }

  getAnalysisResult(streamId: string): AnalysisReport | undefined {
    return this.analysisResults.get(streamId);
  }

  getAllAnalysisResults(): Map<string, AnalysisReport> {
    return new Map(this.analysisResults);
  }

  clearStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.data = [];
      stream.timestamps = [];
      this.analysisResults.delete(streamId);
      this.emit('stream-cleared', { streamId });
    }
  }

  clearAllStreams(): void {
    this.streams.forEach((_, streamId) => {
      this.clearStream(streamId);
    });
    this.emit('all-streams-cleared');
  }

  destroy(): void {
    this.stopRealTimeAnalysis();
    this.clearAllStreams();
    this.removeAllListeners();
  }
}

export default TelemetryAnalyzer;