/**
 * ChartDataProcessor Web Worker
 * 
 * Offloads heavy data processing tasks from the main thread:
 * - Data decimation and resampling
 * - Statistical calculations
 * - FFT and signal processing
 * - Anomaly detection
 * - Data aggregation and windowing
 */

// Worker context
const ctx: Worker = self as any;

// Task handlers
const taskHandlers: Record<string, (data: any) => any> = {
  decimate: handleDecimation,
  aggregate: handleAggregation,
  detectAnomalies: handleAnomalyDetection,
  calculateStats: handleStatistics,
  fft: handleFFT,
  resample: handleResampling,
  smooth: handleSmoothing,
  correlate: handleCorrelation
};

// Message handler
ctx.addEventListener('message', (event) => {
  const { id, task, data } = event.data;
  
  try {
    const handler = taskHandlers[task];
    if (!handler) {
      throw new Error(`Unknown task: ${task}`);
    }
    
    const result = handler(data);
    ctx.postMessage({ id, result });
  } catch (error) {
    ctx.postMessage({ 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Handle data decimation using various algorithms
 */
function handleDecimation(params: {
  data: Array<{ x: number; y: number }>;
  targetPoints: number;
  algorithm: 'lttb' | 'nth' | 'douglas-peucker' | 'visvalingam';
  epsilon?: number;
}): Array<{ x: number; y: number }> {
  const { data, targetPoints, algorithm, epsilon = 1.0 } = params;
  
  if (data.length <= targetPoints) return data;
  
  switch (algorithm) {
    case 'lttb':
      return largestTriangleThreeBuckets(data, targetPoints);
      
    case 'nth':
      return nthPointDecimation(data, targetPoints);
      
    case 'douglas-peucker':
      return douglasPeucker(data, epsilon);
      
    case 'visvalingam':
      return visvalingam(data, targetPoints);
      
    default:
      return data;
  }
}

/**
 * Largest Triangle Three Buckets algorithm
 */
function largestTriangleThreeBuckets(
  data: Array<{ x: number; y: number }>,
  threshold: number
): Array<{ x: number; y: number }> {
  const dataLength = data.length;
  if (threshold >= dataLength || threshold === 0) {
    return data;
  }
  
  const sampled: Array<{ x: number; y: number }> = [];
  const bucketSize = (dataLength - 2) / (threshold - 2);
  
  let a = 0;
  sampled[0] = data[a];
  
  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    
    for (let j = avgRangeStart; j < avgRangeEnd && j < dataLength; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;
    
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    
    const pointAX = data[a].x;
    const pointAY = data[a].y;
    
    let maxArea = -1;
    let nextA = rangeStart;
    
    for (let j = rangeStart; j < rangeEnd && j < dataLength; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].y - pointAY) -
        (pointAX - data[j].x) * (avgY - pointAY)
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    
    sampled[i + 1] = data[nextA];
    a = nextA;
  }
  
  sampled[threshold - 1] = data[dataLength - 1];
  
  return sampled;
}

/**
 * Nth point decimation
 */
function nthPointDecimation(
  data: Array<{ x: number; y: number }>,
  targetPoints: number
): Array<{ x: number; y: number }> {
  const step = Math.floor(data.length / targetPoints);
  const decimated: Array<{ x: number; y: number }> = [];
  
  for (let i = 0; i < data.length; i += step) {
    decimated.push(data[i]);
  }
  
  // Always include last point
  if (decimated[decimated.length - 1] !== data[data.length - 1]) {
    decimated.push(data[data.length - 1]);
  }
  
  return decimated;
}

/**
 * Douglas-Peucker algorithm
 */
function douglasPeucker(
  data: Array<{ x: number; y: number }>,
  epsilon: number
): Array<{ x: number; y: number }> {
  if (data.length <= 2) return data;
  
  const perpDistance = (p: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    
    if (mag > 0) {
      return Math.abs((p.x - p1.x) * dy - (p.y - p1.y) * dx) / mag;
    }
    return 0;
  };
  
  let maxDist = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < data.length - 1; i++) {
    const dist = perpDistance(data[i], data[0], data[data.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  if (maxDist > epsilon) {
    const left = douglasPeucker(data.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(data.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  return [data[0], data[data.length - 1]];
}

/**
 * Visvalingam algorithm
 */
function visvalingam(
  data: Array<{ x: number; y: number }>,
  targetPoints: number
): Array<{ x: number; y: number }> {
  if (data.length <= targetPoints) return data;
  
  const triangleArea = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
    return Math.abs(
      (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2
    );
  };
  
  const points = data.map((p, i) => ({ ...p, index: i, area: Infinity }));
  
  // Calculate initial areas
  for (let i = 1; i < points.length - 1; i++) {
    points[i].area = triangleArea(points[i - 1], points[i], points[i + 1]);
  }
  
  // Remove points with smallest area
  while (points.length > targetPoints) {
    let minArea = Infinity;
    let minIndex = -1;
    
    for (let i = 1; i < points.length - 1; i++) {
      if (points[i].area < minArea) {
        minArea = points[i].area;
        minIndex = i;
      }
    }
    
    if (minIndex === -1) break;
    
    points.splice(minIndex, 1);
    
    // Recalculate areas for neighbors
    if (minIndex > 0 && minIndex < points.length - 1) {
      points[minIndex - 1].area = triangleArea(
        points[minIndex - 2] || points[minIndex - 1],
        points[minIndex - 1],
        points[minIndex]
      );
    }
    if (minIndex < points.length - 1) {
      points[minIndex].area = triangleArea(
        points[minIndex - 1],
        points[minIndex],
        points[minIndex + 1] || points[minIndex]
      );
    }
  }
  
  return points.sort((a, b) => a.index - b.index).map(({ x, y }) => ({ x, y }));
}

/**
 * Handle data aggregation
 */
function handleAggregation(params: {
  data: number[];
  windowSize: number;
  method: 'mean' | 'median' | 'min' | 'max' | 'sum' | 'stddev';
  overlap?: number;
}): number[] {
  const { data, windowSize, method, overlap = 0 } = params;
  const step = Math.max(1, windowSize - overlap);
  const aggregated: number[] = [];
  
  for (let i = 0; i < data.length - windowSize + 1; i += step) {
    const window = data.slice(i, i + windowSize);
    
    switch (method) {
      case 'mean':
        aggregated.push(mean(window));
        break;
      case 'median':
        aggregated.push(median(window));
        break;
      case 'min':
        aggregated.push(Math.min(...window));
        break;
      case 'max':
        aggregated.push(Math.max(...window));
        break;
      case 'sum':
        aggregated.push(sum(window));
        break;
      case 'stddev':
        aggregated.push(stddev(window));
        break;
    }
  }
  
  return aggregated;
}

/**
 * Handle anomaly detection
 */
function handleAnomalyDetection(params: {
  data: number[];
  method: 'zscore' | 'iqr' | 'isolation-forest' | 'mad';
  threshold?: number;
  windowSize?: number;
}): Array<{ index: number; value: number; score: number }> {
  const { data, method, threshold = 3, windowSize = 50 } = params;
  const anomalies: Array<{ index: number; value: number; score: number }> = [];
  
  switch (method) {
    case 'zscore': {
      const rollingMean: number[] = [];
      const rollingStd: number[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        rollingMean[i] = mean(window);
        rollingStd[i] = stddev(window);
      }
      
      for (let i = 0; i < data.length; i++) {
        const zscore = Math.abs((data[i] - rollingMean[i]) / rollingStd[i]);
        if (zscore > threshold) {
          anomalies.push({ index: i, value: data[i], score: zscore });
        }
      }
      break;
    }
    
    case 'iqr': {
      for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        const q1 = percentile(window, 25);
        const q3 = percentile(window, 75);
        const iqr = q3 - q1;
        const lower = q1 - threshold * iqr;
        const upper = q3 + threshold * iqr;
        
        if (data[i] < lower || data[i] > upper) {
          const score = Math.max(
            Math.abs(data[i] - lower) / iqr,
            Math.abs(data[i] - upper) / iqr
          );
          anomalies.push({ index: i, value: data[i], score });
        }
      }
      break;
    }
    
    case 'mad': {
      for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        const med = median(window);
        const mad = median(window.map(x => Math.abs(x - med)));
        const score = Math.abs(data[i] - med) / (mad * 1.4826); // 1.4826 ≈ 1/Φ^(-1)(3/4)
        
        if (score > threshold) {
          anomalies.push({ index: i, value: data[i], score });
        }
      }
      break;
    }
  }
  
  return anomalies;
}

/**
 * Handle statistical calculations
 */
function handleStatistics(params: {
  data: number[];
  stats: Array<'mean' | 'median' | 'stddev' | 'variance' | 'skewness' | 'kurtosis' | 'percentiles'>;
  percentiles?: number[];
}): Record<string, number | number[]> {
  const { data, stats, percentiles: pcts = [25, 50, 75] } = params;
  const result: Record<string, number | number[]> = {};
  
  for (const stat of stats) {
    switch (stat) {
      case 'mean':
        result.mean = mean(data);
        break;
      case 'median':
        result.median = median(data);
        break;
      case 'stddev':
        result.stddev = stddev(data);
        break;
      case 'variance':
        result.variance = variance(data);
        break;
      case 'skewness':
        result.skewness = skewness(data);
        break;
      case 'kurtosis':
        result.kurtosis = kurtosis(data);
        break;
      case 'percentiles':
        result.percentiles = pcts.map(p => percentile(data, p));
        break;
    }
  }
  
  return result;
}

/**
 * Handle FFT computation
 */
function handleFFT(params: {
  data: number[];
  sampleRate: number;
}): { frequencies: number[]; magnitudes: number[]; phases: number[] } {
  const { data, sampleRate } = params;
  const n = data.length;
  const fft = computeFFT(data);
  
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  const phases: number[] = [];
  
  for (let i = 0; i < n / 2; i++) {
    frequencies.push(i * sampleRate / n);
    magnitudes.push(Math.sqrt(fft.real[i] ** 2 + fft.imag[i] ** 2));
    phases.push(Math.atan2(fft.imag[i], fft.real[i]));
  }
  
  return { frequencies, magnitudes, phases };
}

/**
 * Handle data resampling
 */
function handleResampling(params: {
  data: Array<{ x: number; y: number }>;
  targetRate: number;
  method: 'linear' | 'cubic' | 'nearest';
}): Array<{ x: number; y: number }> {
  const { data, targetRate, method } = params;
  
  if (data.length < 2) return data;
  
  const startX = data[0].x;
  const endX = data[data.length - 1].x;
  const duration = endX - startX;
  const targetPoints = Math.floor(duration * targetRate);
  
  const resampled: Array<{ x: number; y: number }> = [];
  
  for (let i = 0; i < targetPoints; i++) {
    const x = startX + (i / targetRate);
    const y = interpolate(data, x, method);
    resampled.push({ x, y });
  }
  
  return resampled;
}

/**
 * Handle data smoothing
 */
function handleSmoothing(params: {
  data: number[];
  method: 'moving-average' | 'exponential' | 'gaussian' | 'savitzky-golay';
  windowSize: number;
  alpha?: number;
  sigma?: number;
  polyOrder?: number;
}): number[] {
  const { data, method, windowSize, alpha = 0.3, sigma = 1, polyOrder = 3 } = params;
  
  switch (method) {
    case 'moving-average':
      return movingAverage(data, windowSize);
      
    case 'exponential':
      return exponentialSmoothing(data, alpha);
      
    case 'gaussian':
      return gaussianSmoothing(data, windowSize, sigma);
      
    case 'savitzky-golay':
      return savitzkyGolay(data, windowSize, polyOrder);
      
    default:
      return data;
  }
}

/**
 * Handle correlation calculation
 */
function handleCorrelation(params: {
  data1: number[];
  data2: number[];
  method: 'pearson' | 'spearman' | 'kendall';
  lag?: number;
}): number {
  const { data1, data2, method, lag = 0 } = params;
  
  // Apply lag
  const d1 = lag >= 0 ? data1.slice(lag) : data1.slice(0, data1.length + lag);
  const d2 = lag >= 0 ? data2.slice(0, data2.length - lag) : data2.slice(-lag);
  
  const n = Math.min(d1.length, d2.length);
  
  switch (method) {
    case 'pearson':
      return pearsonCorrelation(d1.slice(0, n), d2.slice(0, n));
      
    case 'spearman':
      return spearmanCorrelation(d1.slice(0, n), d2.slice(0, n));
      
    case 'kendall':
      return kendallCorrelation(d1.slice(0, n), d2.slice(0, n));
      
    default:
      return 0;
  }
}

// Utility functions

function mean(data: number[]): number {
  return sum(data) / data.length;
}

function sum(data: number[]): number {
  return data.reduce((a, b) => a + b, 0);
}

function median(data: number[]): number {
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(data: number[]): number {
  const m = mean(data);
  return mean(data.map(x => (x - m) ** 2));
}

function stddev(data: number[]): number {
  return Math.sqrt(variance(data));
}

function percentile(data: number[], p: number): number {
  const sorted = [...data].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function skewness(data: number[]): number {
  const m = mean(data);
  const s = stddev(data);
  const n = data.length;
  return (n / ((n - 1) * (n - 2))) * sum(data.map(x => ((x - m) / s) ** 3));
}

function kurtosis(data: number[]): number {
  const m = mean(data);
  const s = stddev(data);
  const n = data.length;
  return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum(data.map(x => ((x - m) / s) ** 4)) - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3));
}

function computeFFT(data: number[]): { real: number[]; imag: number[] } {
  // Simple DFT implementation (not optimized)
  const n = data.length;
  const real: number[] = new Array(n).fill(0);
  const imag: number[] = new Array(n).fill(0);
  
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      real[k] += data[t] * Math.cos(angle);
      imag[k] += data[t] * Math.sin(angle);
    }
  }
  
  return { real, imag };
}

function interpolate(
  data: Array<{ x: number; y: number }>,
  x: number,
  method: 'linear' | 'cubic' | 'nearest'
): number {
  // Find surrounding points
  let i = 0;
  while (i < data.length - 1 && data[i + 1].x < x) i++;
  
  if (i === data.length - 1) return data[i].y;
  if (x <= data[0].x) return data[0].y;
  
  switch (method) {
    case 'nearest':
      return Math.abs(x - data[i].x) < Math.abs(x - data[i + 1].x) ? data[i].y : data[i + 1].y;
      
    case 'linear': {
      const t = (x - data[i].x) / (data[i + 1].x - data[i].x);
      return data[i].y * (1 - t) + data[i + 1].y * t;
    }
    
    case 'cubic':
      // Simplified cubic interpolation
      // In production, use proper cubic spline
      return interpolate(data, x, 'linear');
      
    default:
      return 0;
  }
}

function movingAverage(data: number[], windowSize: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
    const window = data.slice(start, end);
    result.push(mean(window));
  }
  
  return result;
}

function exponentialSmoothing(data: number[], alpha: number): number[] {
  const result: number[] = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  
  return result;
}

function gaussianSmoothing(data: number[], windowSize: number, sigma: number): number[] {
  // Generate Gaussian kernel
  const kernel: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = -halfWindow; i <= halfWindow; i++) {
    kernel.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  }
  
  const kernelSum = sum(kernel);
  const normalizedKernel = kernel.map(k => k / kernelSum);
  
  // Apply convolution
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    let smoothed = 0;
    
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const dataIndex = i + j;
      if (dataIndex >= 0 && dataIndex < data.length) {
        smoothed += data[dataIndex] * normalizedKernel[j + halfWindow];
      }
    }
    
    result.push(smoothed);
  }
  
  return result;
}

function savitzkyGolay(data: number[], windowSize: number, polyOrder: number): number[] {
  // Simplified implementation
  // In production, use proper Savitzky-Golay coefficients
  return movingAverage(data, windowSize);
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  
  let num = 0;
  let denX = 0;
  let denY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  return num / Math.sqrt(denX * denY);
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  return pearsonCorrelation(rankX, rankY);
}

function kendallCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  let concordant = 0;
  let discordant = 0;
  
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const xDiff = x[j] - x[i];
      const yDiff = y[j] - y[i];
      
      if (xDiff * yDiff > 0) {
        concordant++;
      } else if (xDiff * yDiff < 0) {
        discordant++;
      }
    }
  }
  
  return (concordant - discordant) / (n * (n - 1) / 2);
}

function getRanks(data: number[]): number[] {
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

// Export for TypeScript
export {};