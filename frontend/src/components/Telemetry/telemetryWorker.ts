// WebWorker for off-thread telemetry data processing

interface WorkerMessage {
  type: 'process' | 'decimate' | 'analyze' | 'filter';
  data: any;
  id: string;
}

interface WorkerResponse {
  type: string;
  result?: any;
  error?: string;
  id: string;
}

// Fast Fourier Transform for frequency analysis
function fft(data: number[]): { frequencies: number[], magnitudes: number[] } {
  const N = data.length;
  const frequencies: number[] = [];
  const magnitudes: number[] = [];

  // Simple DFT implementation (replace with FFT library for production)
  for (let k = 0; k < N / 2; k++) {
    let real = 0;
    let imag = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      real += data[n] * Math.cos(angle);
      imag += data[n] * Math.sin(angle);
    }
    
    frequencies.push(k);
    magnitudes.push(Math.sqrt(real * real + imag * imag) / N);
  }

  return { frequencies, magnitudes };
}

// Largest Triangle Three Buckets (LTTB) decimation
function lttbDecimate(data: Array<{ timestamp: number, value: number }>, threshold: number) {
  if (data.length <= threshold) return data;

  const decimated = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  
  // Always keep first point
  decimated.push(data[0]);

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 0) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);
    
    const rangeLength = rangeEnd - rangeStart;
    if (rangeLength === 0) continue;

    // Calculate average of next bucket for triangle calculation
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
    
    let avgX = 0;
    let avgY = 0;
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += data[j].timestamp;
      avgY += data[j].value;
    }
    avgX /= (nextBucketEnd - nextBucketStart);
    avgY /= (nextBucketEnd - nextBucketStart);

    // Find point in bucket with largest triangle area
    let maxArea = -1;
    let maxIndex = rangeStart;
    
    const prevPoint = decimated[decimated.length - 1];
    
    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (prevPoint.timestamp - avgX) * (data[j].value - prevPoint.value) -
        (prevPoint.timestamp - data[j].timestamp) * (avgY - prevPoint.value)
      );
      
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }
    
    decimated.push(data[maxIndex]);
  }

  // Always keep last point
  decimated.push(data[data.length - 1]);
  
  return decimated;
}

// Moving average filter
function movingAverage(data: number[], windowSize: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
    
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += data[j];
    }
    
    result.push(sum / (end - start));
  }
  
  return result;
}

// Kalman filter for noise reduction
class KalmanFilter {
  private x: number = 0; // State estimate
  private P: number = 1; // Error covariance
  private Q: number = 0.1; // Process noise
  private R: number = 1; // Measurement noise

  constructor(processNoise = 0.1, measurementNoise = 1) {
    this.Q = processNoise;
    this.R = measurementNoise;
  }

  filter(measurement: number): number {
    // Prediction
    const xPred = this.x;
    const PPred = this.P + this.Q;

    // Update
    const K = PPred / (PPred + this.R); // Kalman gain
    this.x = xPred + K * (measurement - xPred);
    this.P = (1 - K) * PPred;

    return this.x;
  }

  reset() {
    this.x = 0;
    this.P = 1;
  }
}

// Statistical analysis
function analyzeData(data: number[]) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];
  
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  
  // Calculate percentiles
  const p95 = sorted[Math.floor(n * 0.95)];
  const p99 = sorted[Math.floor(n * 0.99)];
  
  // Detect outliers using IQR method
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = data.filter(v => v < lowerBound || v > upperBound);
  
  return {
    mean,
    median,
    stdDev,
    variance,
    min,
    max,
    q1,
    q3,
    p95,
    p99,
    outlierCount: outliers.length,
    outlierPercentage: (outliers.length / n) * 100,
  };
}

// Handle messages from main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, data, id } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'decimate':
        result = lttbDecimate(data.points, data.threshold);
        break;
        
      case 'analyze':
        const values = data.points.map((p: any) => p.value);
        result = {
          statistics: analyzeData(values),
          fft: data.includeFft ? fft(values) : null,
        };
        break;
        
      case 'filter':
        const inputValues = data.points.map((p: any) => p.value);
        let filteredValues: number[];
        
        if (data.filterType === 'movingAverage') {
          filteredValues = movingAverage(inputValues, data.windowSize || 5);
        } else if (data.filterType === 'kalman') {
          const kalman = new KalmanFilter(data.processNoise, data.measurementNoise);
          filteredValues = inputValues.map(v => kalman.filter(v));
        } else {
          filteredValues = inputValues;
        }
        
        result = data.points.map((p: any, i: number) => ({
          ...p,
          value: filteredValues[i],
        }));
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    const response: WorkerResponse = { type, result, id };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = { 
      type, 
      error: error instanceof Error ? error.message : 'Unknown error', 
      id 
    };
    self.postMessage(response);
  }
});

// Signal ready
self.postMessage({ type: 'ready' });